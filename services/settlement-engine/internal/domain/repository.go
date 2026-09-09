package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrIdempotencyConflict = errors.New("idempotency key was already used for a different stake")
	ErrPendingStakes       = errors.New("market admission is closed; admitted stakes are still processing, retry shortly")
	ErrAdmissionOpen       = errors.New("lock the market before computing settlement")
)

const (
	StakePending  = "pending"
	StakeAccepted = "accepted"
	StakeRejected = "rejected"
)

type Stake struct {
	ID             string    `json:"id"`
	UserID         string    `json:"-"`
	IdempotencyKey string    `json:"-"`
	MarketID       string    `json:"marketId"`
	OutcomeID      string    `json:"outcomeId"`
	Amount         int64     `json:"amount"`
	State          string    `json:"state"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

func (s Stake) Matches(other Stake) bool {
	return s.UserID == other.UserID && s.MarketID == other.MarketID &&
		s.OutcomeID == other.OutcomeID && s.Amount == other.Amount
}

// Admission and Close serialize on the same durable market gate. Wallet
// operations run outside this transaction and are retried by stake ID.
type StakeRepository interface {
	Find(context.Context, string, string) (*Stake, error)
	Admit(context.Context, Stake, Market) (*Stake, error)
	Complete(context.Context, string, string) error
	Pending(context.Context, int) ([]Stake, error)
	Touch(context.Context, string) error
	Snapshot(context.Context, string, bool) (*Pool, error)
	Close(context.Context, string) error
}
