package domain

import (
	"context"
	"errors"
	"math/big"
	"sort"
)

var ErrResolutionConflict = errors.New("market has no valid resolution or its recorded decision conflicts")
var ErrForbidden = errors.New("administrator access is required")

type Payout struct {
	StakeID string `json:"stakeId"`
	UserID  string `json:"userId"`
	Amount  int64  `json:"amount"`
}
type Resolution struct {
	MarketID         string   `json:"marketId"`
	WinningOutcomeID string   `json:"winningOutcomeId"`
	Cancelled        bool     `json:"cancelled"`
	Kind             string   `json:"kind"`
	Total            int64    `json:"total"`
	Payouts          []Payout `json:"payouts"`
	Completed        bool     `json:"completed"`
}
type Prediction struct {
	Stake
	Result string `json:"result"`
	Payout int64  `json:"payout"`
}
type ResolutionRepository interface {
	Plan(context.Context, Market) (*Resolution, error)
	TouchResolution(context.Context, string) error
	FinishResolution(context.Context, string) error
	PendingResolutions(context.Context) ([]Resolution, error)
	Predictions(context.Context, string, int, int) ([]Prediction, error)
}
type PayoutClient interface {
	PayResolution(context.Context, Resolution) error
}

// Largest-remainder allocation by stake ID. Use exact integers for both the
// quotient and remainder; a stable tie-break ensures retries agree on every coin.
func BuildResolution(market Market, stakes []Stake) (*Resolution, error) {
	cancelled := market.Status == "refunding" || market.Status == "cancelled"
	if !cancelled && market.Status != "settling" && market.Status != "settled" {
		return nil, ErrResolutionConflict
	}
	result := &Resolution{MarketID: market.ID, WinningOutcomeID: market.WinningOutcomeID, Cancelled: cancelled, Kind: "payout", Payouts: []Payout{}}
	total, winning := new(big.Int), new(big.Int)
	for _, s := range stakes {
		total.Add(total, big.NewInt(s.Amount))
		if s.OutcomeID == market.WinningOutcomeID {
			winning.Add(winning, big.NewInt(s.Amount))
		}
	}
	if !total.IsInt64() {
		return nil, ErrResolutionConflict
	}
	result.Total = total.Int64()
	if cancelled || winning.Sign() == 0 {
		result.Kind = "refund"
	}
	type remainder struct {
		index int
		value *big.Int
		id    string
	}
	remainders := []remainder{}
	allocated := int64(0)
	sort.Slice(stakes, func(i, j int) bool { return stakes[i].ID < stakes[j].ID })
	for _, s := range stakes {
		amount := int64(0)
		if result.Kind == "refund" {
			amount = s.Amount
		} else if s.OutcomeID == market.WinningOutcomeID {
			numerator := new(big.Int).Mul(big.NewInt(s.Amount), total)
			quotient, rem := new(big.Int), new(big.Int)
			quotient.QuoRem(numerator, winning, rem)
			amount = quotient.Int64()
			remainders = append(remainders, remainder{len(result.Payouts), rem, s.ID})
		}
		result.Payouts = append(result.Payouts, Payout{s.ID, s.UserID, amount})
		allocated += amount
	}
	sort.Slice(remainders, func(i, j int) bool {
		c := remainders[i].value.Cmp(remainders[j].value)
		if c == 0 {
			return remainders[i].id < remainders[j].id
		}
		return c > 0
	})
	for i := int64(0); i < result.Total-allocated; i++ {
		result.Payouts[remainders[i].index].Amount++
	}
	return result, nil
}
