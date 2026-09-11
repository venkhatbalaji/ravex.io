package marketclient

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"ravex/settlement-engine/internal/domain"
)

type HTTPClient struct {
	baseURL string
	client  *http.Client
}

func NewHTTPClient(baseURL string) *HTTPClient {
	return &HTTPClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		client:  &http.Client{Timeout: 5 * time.Second},
	}
}

func (c *HTTPClient) GetMarket(ctx context.Context, marketID string) (domain.Market, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/markets/"+url.PathEscape(marketID), nil)
	if err != nil {
		return domain.Market{}, fmt.Errorf("building catalog request: %w", err)
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return domain.Market{}, fmt.Errorf("calling catalog: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return domain.Market{}, domain.ErrMarketNotFound
	}
	if resp.StatusCode != http.StatusOK {
		return domain.Market{}, fmt.Errorf("catalog returned status %d", resp.StatusCode)
	}
	var dto struct {
		WinningOutcomeID string    `json:"winningOutcomeId"`
		ID               string    `json:"id"`
		Status           string    `json:"status"`
		EventStartAt     time.Time `json:"eventStartAt"`
		Outcomes         []struct {
			ID string `json:"id"`
		} `json:"outcomes"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&dto); err != nil {
		return domain.Market{}, fmt.Errorf("decoding catalog response: %w", err)
	}
	if !strings.EqualFold(dto.ID, marketID) || dto.Status == "" || dto.EventStartAt.IsZero() || len(dto.Outcomes) < 2 {
		return domain.Market{}, fmt.Errorf("catalog returned an incomplete or mismatched market")
	}
	market := domain.Market{WinningOutcomeID: dto.WinningOutcomeID, ID: dto.ID, Status: dto.Status, EventStartAt: dto.EventStartAt}
	for _, outcome := range dto.Outcomes {
		if outcome.ID == "" {
			return domain.Market{}, fmt.Errorf("catalog returned an empty outcome ID")
		}
		market.OutcomeIDs = append(market.OutcomeIDs, outcome.ID)
	}
	return market, nil
}
