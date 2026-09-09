package store_test

import (
	"context"
	"errors"
	"github.com/google/uuid"
	"os"
	"ravex/settlement-engine/internal/domain"
	"ravex/settlement-engine/internal/service"
	"ravex/settlement-engine/internal/store"
	"sync"
	"testing"
	"time"
)

func repository(t *testing.T) *store.PostgresRepository {
	t.Helper()
	connection := os.Getenv("TEST_DATABASE_URL")
	if connection == "" {
		t.Skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
	}
	repo, err := store.Open(context.Background(), connection)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { repo.Shutdown() })
	return repo
}
func proposed() domain.Stake {
	return domain.Stake{ID: uuid.NewString(), UserID: uuid.NewString(), IdempotencyKey: uuid.NewString(), MarketID: uuid.NewString(), OutcomeID: uuid.NewString(), Amount: 10}
}
func definition(stake domain.Stake, cutoff time.Time) domain.Market {
	return domain.Market{ID: stake.MarketID, Status: "open", EventStartAt: cutoff, OutcomeIDs: []string{stake.OutcomeID}}
}
func TestConcurrentAdmissionAndRetry(t *testing.T) {
	repo := repository(t)
	ctx := context.Background()
	stake := proposed()
	cutoff := time.Now().Add(time.Hour)
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			copy := stake
			copy.ID = uuid.NewString()
			saved, err := repo.Admit(ctx, copy, definition(copy, cutoff))
			if err != nil {
				t.Error(err)
				return
			}
			if err = repo.Complete(ctx, saved.ID, domain.StakeAccepted); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	pool, err := repo.Snapshot(ctx, stake.MarketID, false)
	if err != nil || pool.GrandTotal() != 10 {
		t.Fatalf("duplicate admission changed totals: %+v %v", pool, err)
	}
	conflict := stake
	conflict.Amount = 11
	if _, err = repo.Admit(ctx, conflict, definition(conflict, cutoff)); !errors.Is(err, domain.ErrIdempotencyConflict) {
		t.Fatalf("payload conflict: %v", err)
	}
	if err = repo.Close(ctx, stake.MarketID); err != nil {
		t.Fatal(err)
	}
	// Reopen the connection to model restart, then retry after cutoff/closure.
	reopened := repository(t)
	if _, err = reopened.Admit(ctx, stake, definition(stake, time.Now().Add(-time.Hour))); err != nil {
		t.Fatalf("retry after restart and cutoff: %v", err)
	}
	pool, err = reopened.Snapshot(ctx, stake.MarketID, true)
	if err != nil || pool.GrandTotal() != 10 {
		t.Fatalf("restart lost pool: %+v %v", pool, err)
	}
}
func TestCloseDrainsPendingAndRejectsNewStakes(t *testing.T) {
	repo := repository(t)
	ctx := context.Background()
	stake := proposed()
	cutoff := time.Now().Add(time.Hour)
	saved, err := repo.Admit(ctx, stake, definition(stake, cutoff))
	if err != nil {
		t.Fatal(err)
	}
	if err = repo.Close(ctx, stake.MarketID); !errors.Is(err, domain.ErrPendingStakes) {
		t.Fatalf("expected pending, got %v", err)
	}
	next := stake
	next.ID = uuid.NewString()
	next.IdempotencyKey = uuid.NewString()
	if _, err = repo.Admit(ctx, next, definition(next, cutoff)); !errors.Is(err, domain.ErrMarketClosed) {
		t.Fatalf("admitted after closure: %v", err)
	}
	if _, err = repo.Snapshot(ctx, stake.MarketID, true); !errors.Is(err, domain.ErrPendingStakes) {
		t.Fatalf("final snapshot before drain: %v", err)
	}
	if err = repo.Complete(ctx, saved.ID, domain.StakeAccepted); err != nil {
		t.Fatal(err)
	}
	if err = repo.Close(ctx, stake.MarketID); err != nil {
		t.Fatal(err)
	}
	if err = repo.Complete(ctx, saved.ID, domain.StakeRejected); err == nil {
		t.Fatal("terminal decision changed")
	}
}
func TestCloseRacesAdmission(t *testing.T) {
	repo := repository(t)
	ctx := context.Background()
	for i := 0; i < 20; i++ {
		stake := proposed()
		barrier := make(chan struct{})
		var admitted, closed error
		var wg sync.WaitGroup
		wg.Add(2)
		go func() {
			defer wg.Done()
			<-barrier
			_, admitted = repo.Admit(ctx, stake, definition(stake, time.Now().Add(time.Hour)))
		}()
		go func() { defer wg.Done(); <-barrier; closed = repo.Close(ctx, stake.MarketID) }()
		close(barrier)
		wg.Wait()
		if admitted == nil {
			if !errors.Is(closed, domain.ErrPendingStakes) {
				t.Fatalf("close missed admitted pending stake: %v", closed)
			}
			if err := repo.Complete(ctx, stake.ID, domain.StakeRejected); err != nil {
				t.Fatal(err)
			}
		} else if !errors.Is(admitted, domain.ErrMarketClosed) || closed != nil {
			t.Fatalf("unexpected race outcome: admit=%v close=%v", admitted, closed)
		}
	}
}
func TestDatabaseCutoff(t *testing.T) {
	repo := repository(t)
	stake := proposed()
	if _, err := repo.Admit(context.Background(), stake, definition(stake, time.Now().Add(-time.Second))); !errors.Is(err, domain.ErrMarketClosed) {
		t.Fatal(err)
	}
}

type catalog struct{ market domain.Market }

func (c catalog) GetMarket(context.Context, string) (domain.Market, error) { return c.market, nil }

// Models a committed debit whose HTTP response was lost. The same stake ID
// returns the saved decision, with only one actual debit.
type ambiguousWallet struct {
	mu     sync.Mutex
	seen   map[string]bool
	debits int
}

func (w *ambiguousWallet) DebitStake(_ context.Context, s domain.Stake) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if !w.seen[s.ID] {
		w.seen[s.ID] = true
		w.debits++
		return errors.New("response lost after debit")
	}
	return nil
}
func TestRecoveryAfterLostWalletResponse(t *testing.T) {
	repo := repository(t)
	ctx := context.Background()
	stake := proposed()
	wallet := &ambiguousWallet{seen: map[string]bool{}}
	markets := catalog{domain.Market{ID: stake.MarketID, Status: "open", EventStartAt: time.Now().Add(time.Hour), OutcomeIDs: []string{stake.OutcomeID}}}
	useCase := service.NewSettlementService(repo, wallet, markets)
	result, err := useCase.PlaceStake(ctx, stake.UserID, stake.IdempotencyKey, stake.MarketID, stake.OutcomeID, stake.Amount)
	if err != nil || result.State != domain.StakePending {
		t.Fatalf("ambiguous debit must stay pending: %+v %v", result, err)
	}
	restarted := service.NewSettlementService(repository(t), wallet, markets)
	workerCtx, cancel := context.WithCancel(ctx)
	done := make(chan struct{})
	go func() { defer close(done); restarted.Recover(workerCtx) }()
	defer func() { cancel(); <-done }()
	deadline := time.Now().Add(10 * time.Second)
	for {
		saved, err := repo.Find(ctx, stake.UserID, stake.IdempotencyKey)
		if err != nil {
			t.Fatal(err)
		}
		if saved.State == domain.StakeAccepted {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("recovery did not finish")
		}
		time.Sleep(20 * time.Millisecond)
	}
	wallet.mu.Lock()
	defer wallet.mu.Unlock()
	if !wallet.seen[result.ID] || wallet.debits != 1 {
		t.Fatalf("recovery changed debit identity or count: %d", wallet.debits)
	}
	pool, err := repo.Snapshot(ctx, stake.MarketID, false)
	if err != nil || pool.GrandTotal() != 10 {
		t.Fatalf("recovered pool %+v %v", pool, err)
	}
}
