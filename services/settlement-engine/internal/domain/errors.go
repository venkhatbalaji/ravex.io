package domain

import "errors"

var (
	ErrInvalidAmount     = errors.New("amount must be positive")
	ErrNoStakesOnOutcome = errors.New("no stakes were placed on the winning outcome")
)
