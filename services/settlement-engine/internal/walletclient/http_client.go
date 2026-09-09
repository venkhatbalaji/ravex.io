package walletclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"ravex/settlement-engine/internal/domain"
	"strings"
	"time"
)

type HTTPClient struct {
	baseURL, serviceKey string
	client              *http.Client
}

func NewHTTPClient(baseURL, serviceKey string) *HTTPClient {
	return &HTTPClient{baseURL: strings.TrimRight(baseURL, "/"), serviceKey: serviceKey, client: &http.Client{Timeout: 5 * time.Second}}
}

func (c *HTTPClient) DebitStake(ctx context.Context, stake domain.Stake) error {
	body, err := json.Marshal(map[string]any{"userId": stake.UserID, "marketId": stake.MarketID, "outcomeId": stake.OutcomeID, "amount": stake.Amount})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/internal/stakes/"+stake.ID, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Service-Key", c.serviceKey)
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("wallet debit: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 && resp.StatusCode != 402 {
		return fmt.Errorf("wallet returned status %d", resp.StatusCode)
	}
	var result struct {
		StakeID  string `json:"stakeId"`
		Accepted bool   `json:"accepted"`
		Debited  int64  `json:"debited"`
	}
	if err = json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("wallet response: %w", err)
	}
	if result.StakeID != stake.ID {
		return fmt.Errorf("wallet returned a mismatched stake")
	}
	if resp.StatusCode == 200 && result.Accepted && result.Debited == stake.Amount {
		return nil
	}
	if resp.StatusCode == 402 && !result.Accepted && result.Debited == 0 {
		return domain.ErrInsufficientBalance
	}
	return fmt.Errorf("wallet returned an inconsistent decision")
}
