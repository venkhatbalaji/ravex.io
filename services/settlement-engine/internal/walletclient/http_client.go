package walletclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"ravex/settlement-engine/internal/domain"
)

// HTTPClient is the adapter for domain.WalletClient — a direct synchronous
// call to Wallet & Ledger's POST /wallet/me/stake, using the caller's own
// bearer token so Wallet's existing JWT auth decides whose balance moves.
type HTTPClient struct {
	baseURL string
	client  *http.Client
}

func NewHTTPClient(baseURL string) *HTTPClient {
	return &HTTPClient{baseURL: baseURL, client: &http.Client{Timeout: 5 * time.Second}}
}

type stakeRequest struct {
	MarketID  string `json:"marketId"`
	OutcomeID string `json:"outcomeId"`
	Amount    int64  `json:"amount"`
}

func (c *HTTPClient) DebitStake(ctx context.Context, bearerToken, marketID, outcomeID string, amount int64) error {
	body, err := json.Marshal(stakeRequest{MarketID: marketID, OutcomeID: outcomeID, Amount: amount})
	if err != nil {
		return fmt.Errorf("encoding stake request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/wallet/me/stake", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("building wallet request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if bearerToken != "" {
		req.Header.Set("Authorization", bearerToken)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("calling wallet service: %w", err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
		return nil
	case http.StatusUnauthorized:
		return domain.ErrUnauthorized
	case http.StatusPaymentRequired:
		return domain.ErrInsufficientBalance
	default:
		return fmt.Errorf("wallet service returned status %d", resp.StatusCode)
	}
}
