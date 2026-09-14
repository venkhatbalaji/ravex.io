package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"net/http"
	"net/http/httptest"
	"ravex/settlement-engine/internal/domain"
	"ravex/settlement-engine/internal/identityclient"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"ravex/settlement-engine/internal/marketclient"
	"ravex/settlement-engine/internal/service"

	"ravex/settlement-engine/internal/walletclient"
)

// Exercise the public handler and both real HTTP adapters. Rejected catalog
// checks must leave the wallet untouched and the pool empty.
func TestStakeAdmission(t *testing.T) {
	future := time.Now().Add(time.Hour).UTC().Format(time.RFC3339Nano)
	past := time.Now().Add(-time.Hour).UTC().Format(time.RFC3339Nano)
	market := func(status, start string) string {
		return fmt.Sprintf(`{"id":"11111111-1111-4111-8111-111111111111","status":%q,"eventStartAt":%q,"outcomes":[{"id":"33333333-3333-4333-8333-333333333333"},{"id":"44444444-4444-4444-8444-444444444444"}]}`, status, start)
	}
	for _, tc := range []struct {
		name          string
		catalogStatus int
		catalogBody   string
		walletStatus  int
		requestBody   string
		wantStatus    int
		wantDebits    int32
		wantPool      int64
	}{
		{"valid", 200, market("open", future), 200, `{"outcomeId":"33333333-3333-4333-8333-333333333333","amount":10}`, 200, 1, 10},
		{"missing market", 404, `{}`, 200, `{"outcomeId":"33333333-3333-4333-8333-333333333333","amount":10}`, 404, 0, 0},
		{"locked", 200, market("locked", future), 200, `{"outcomeId":"33333333-3333-4333-8333-333333333333","amount":10}`, 409, 0, 0},
		{"settled", 200, market("settled", future), 200, `{"outcomeId":"33333333-3333-4333-8333-333333333333","amount":10}`, 409, 0, 0},
		{"started while still open", 200, market("open", past), 200, `{"outcomeId":"33333333-3333-4333-8333-333333333333","amount":10}`, 409, 0, 0},
		{"foreign outcome", 200, market("open", future), 200, `{"outcomeId":"55555555-5555-4555-8555-555555555555","amount":10}`, 400, 0, 0},
		{"catalog unavailable", 503, `{}`, 200, `{"outcomeId":"33333333-3333-4333-8333-333333333333","amount":10}`, 502, 0, 0},
		{"malformed catalog response", 200, `invalid`, 200, `{"outcomeId":"33333333-3333-4333-8333-333333333333","amount":10}`, 502, 0, 0},
		{"incomplete catalog response", 200, `{}`, 200, `{"outcomeId":"33333333-3333-4333-8333-333333333333","amount":10}`, 502, 0, 0},
		{"mismatched catalog response", 200, strings.Replace(market("open", future), "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", 1), 200, `{"outcomeId":"33333333-3333-4333-8333-333333333333","amount":10}`, 502, 0, 0},
		{"zero amount", 200, market("open", future), 200, `{"outcomeId":"33333333-3333-4333-8333-333333333333","amount":0}`, 400, 0, 0},
		{"negative amount", 200, market("open", future), 200, `{"outcomeId":"33333333-3333-4333-8333-333333333333","amount":-1}`, 400, 0, 0},
		{"insufficient balance", 200, market("open", future), 402, `{"outcomeId":"33333333-3333-4333-8333-333333333333","amount":10}`, 402, 1, 0},
		{"wallet unauthorized", 200, market("open", future), 401, `{"outcomeId":"33333333-3333-4333-8333-333333333333","amount":10}`, 202, 1, 0},
		{"wallet unavailable", 200, market("open", future), 503, `{"outcomeId":"33333333-3333-4333-8333-333333333333","amount":10}`, 202, 1, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var debits atomic.Int32
			catalog := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodGet || r.URL.Path != "/markets/11111111-1111-4111-8111-111111111111" {
					t.Errorf("unexpected catalog request: %s %s", r.Method, r.URL.Path)
				}
				w.WriteHeader(tc.catalogStatus)
				_, _ = w.Write([]byte(tc.catalogBody))
			}))
			defer catalog.Close()
			wallet := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				debits.Add(1)
				if r.Method != http.MethodPost || !strings.HasPrefix(r.URL.Path, "/internal/stakes/") || r.Header.Get("X-Service-Key") != "test-service-key" || r.Header.Get("Authorization") != "" {
					t.Error("wallet request must use internal service authorization")
				}
				var body struct {
					MarketID  string `json:"marketId"`
					OutcomeID string `json:"outcomeId"`
					Amount    int64  `json:"amount"`
				}
				if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.MarketID != "11111111-1111-4111-8111-111111111111" || body.OutcomeID != "33333333-3333-4333-8333-333333333333" || body.Amount != 10 {
					t.Errorf("unexpected wallet payload: %+v (%v)", body, err)
				}
				w.WriteHeader(tc.walletStatus)
				debited := int64(0)
				if tc.walletStatus == 200 {
					debited = 10
				}
				_ = json.NewEncoder(w).Encode(map[string]any{"stakeId": strings.TrimPrefix(r.URL.Path, "/internal/stakes/"), "accepted": tc.walletStatus == 200, "debited": debited})
			}))
			defer wallet.Close()
			repo := &testRepository{}
			identity := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Header.Get("Authorization") != "Bearer test-token" {
					w.WriteHeader(401)
					return
				}
				_, _ = w.Write([]byte(`{"id":"66666666-6666-4666-8666-666666666666"}`))
			}))
			defer identity.Close()
			useCase := service.NewSettlementService(repo, walletclient.NewHTTPClient(wallet.URL, "test-service-key"), marketclient.NewHTTPClient(catalog.URL))
			req := httptest.NewRequest(http.MethodPost, "/pools/11111111-1111-4111-8111-111111111111/stakes", strings.NewReader(tc.requestBody))
			req.Header.Set("Authorization", "Bearer test-token")
			req.Header.Set("Idempotency-Key", uuid.NewString())
			response := httptest.NewRecorder()
			NewServer(useCase, identityclient.NewHTTPClient(identity.URL), "test-service-key", nil, nil).Routes().ServeHTTP(response, req)
			if response.Code != tc.wantStatus {
				t.Fatalf("status %d, want %d: %s", response.Code, tc.wantStatus, response.Body.String())
			}
			if got := debits.Load(); got != tc.wantDebits {
				t.Errorf("wallet calls %d, want %d", got, tc.wantDebits)
			}
			pool, _ := repo.Snapshot(context.Background(), "11111111-1111-4111-8111-111111111111", false)
			if got := pool.GrandTotal(); got != tc.wantPool {
				t.Errorf("pool total %d, want %d", got, tc.wantPool)
			}
		})
	}
}

// A small test double for handler tests; production always uses PostgreSQL.
type testRepository struct {
	mu    sync.Mutex
	stake *domain.Stake
}

func (r *testRepository) Find(_ context.Context, user, key string) (*domain.Stake, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.stake == nil {
		return nil, nil
	}
	copy := *r.stake
	return &copy, nil
}
func (r *testRepository) Admit(_ context.Context, s domain.Stake, market domain.Market) (*domain.Stake, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if err := market.ValidateStake(s.OutcomeID, time.Now()); err != nil {
		return nil, err
	}
	s.State = domain.StakePending
	r.stake = &s
	copy := s
	return &copy, nil
}
func (r *testRepository) Complete(_ context.Context, _ string, state string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.stake.State = state
	return nil
}
func (r *testRepository) Touch(context.Context, string) error                  { return nil }
func (r *testRepository) Pending(context.Context, int) ([]domain.Stake, error) { return nil, nil }
func (r *testRepository) Close(context.Context, string) error                  { return nil }
func (r *testRepository) Snapshot(_ context.Context, market string, _ bool) (*domain.Pool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	p := domain.NewPool(market)
	if r.stake != nil && r.stake.State == domain.StakeAccepted {
		p.Totals[r.stake.OutcomeID] = r.stake.Amount
	}
	return p, nil
}
