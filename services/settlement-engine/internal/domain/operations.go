package domain

import (
	"context"
	"time"
)

// Operational views deliberately exclude player identity and request credentials.
type PendingOperation struct {
	ID        string    `json:"id"`
	MarketID  string    `json:"marketId"`
	Kind      string    `json:"kind"`
	Amount    int64     `json:"amount"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}
type Operations struct {
	ObservedAt         time.Time          `json:"observedAt"`
	PendingDebits      int64              `json:"pendingDebits"`
	PendingResolutions int64              `json:"pendingResolutions"`
	OldestPendingAt    *time.Time         `json:"oldestPendingAt"`
	Items              []PendingOperation `json:"items"`
	NextOffset         *int               `json:"nextOffset"`
}
type OperationsRepository interface {
	Operations(context.Context, int, int) (*Operations, error)
	Ready(context.Context) error
}
