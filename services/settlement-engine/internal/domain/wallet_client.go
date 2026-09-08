package domain

import (
	"context"
	"errors"
)

var (
	ErrInsufficientBalance = errors.New("insufficient balance")
	ErrUnauthorized        = errors.New("unauthorized")
)

// WalletClient is the port to the Wallet service. A stake must debit a real
// balance before it counts toward a pool — this is called synchronously,
// before AddStake, so an unbacked stake never enters the pool in the first
// place instead of needing to be reversed later.
type WalletClient interface {
	DebitStake(ctx context.Context, bearerToken, marketID, outcomeID string, amount int64) error
}
