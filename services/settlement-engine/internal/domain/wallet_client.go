package domain

import (
	"context"
	"errors"
)

var (
	ErrInsufficientBalance = errors.New("insufficient balance")
	ErrUnauthorized        = errors.New("unauthorized")
)

type WalletClient interface {
	// Returns a saved terminal decision, including insufficient balance.
	// Transport failures are ambiguous and must leave the stake pending.
	DebitStake(context.Context, Stake) error
}

type IdentityClient interface {
	CurrentAdmin(context.Context, string) (string, error)
	CurrentUser(context.Context, string) (string, error)
}
