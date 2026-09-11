package walletclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"ravex/settlement-engine/internal/domain"
)

func (c *HTTPClient) PayResolution(ctx context.Context, plan domain.Resolution) error {
	body, err := json.Marshal(map[string]any{"kind": plan.Kind, "payouts": plan.Payouts})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/internal/settlements/"+plan.MarketID, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Service-Key", c.serviceKey)
	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("wallet payout status %d", resp.StatusCode)
	}
	var result struct {
		MarketID string `json:"marketId"`
		Total    int64  `json:"total"`
	}
	if err = json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return err
	}
	if result.MarketID != plan.MarketID || result.Total != plan.Total {
		return fmt.Errorf("wallet payout response mismatch")
	}
	return nil
}
