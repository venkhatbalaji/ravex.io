package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrMarketNotFound = errors.New("market not found")
	ErrMarketClosed   = errors.New("market is no longer accepting stakes")
	ErrUnknownOutcome = errors.New("outcome does not belong to this market")
)

// MarketClient reads the catalog through its API, keeping its persistence
// details outside the settlement service.
type MarketClient interface {
	GetMarket(ctx context.Context, marketID string) (Market, error)
}

type Market struct {
	WinningOutcomeID string
	ID               string
	Status           string
	EventStartAt     time.Time
	OutcomeIDs       []string
}

func (m Market) ValidateStake(outcomeID string, now time.Time) error {
	if m.Status != "open" || !now.Before(m.EventStartAt) {
		return ErrMarketClosed
	}
	for _, id := range m.OutcomeIDs {
		if id == outcomeID {
			return nil
		}
	}
	return ErrUnknownOutcome
}
