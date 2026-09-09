package domain

import (
	"errors"
	"testing"
	"time"
)

func TestMarketStakeCutoff(t *testing.T) {
	start := time.Date(2027, 3, 20, 14, 0, 0, 0, time.UTC)
	market := Market{Status: "open", EventStartAt: start, OutcomeIDs: []string{"home", "away"}}
	for _, tc := range []struct {
		name string
		now  time.Time
		want error
	}{
		{"before start", start.Add(-time.Nanosecond), nil},
		{"exactly at start", start, ErrMarketClosed},
		{"after start", start.Add(time.Nanosecond), ErrMarketClosed},
		{"same instant in IST", start.In(time.FixedZone("IST", 19800)), ErrMarketClosed},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if err := market.ValidateStake("home", tc.now); !errors.Is(err, tc.want) {
				t.Fatalf("got %v, want %v", err, tc.want)
			}
		})
	}
}
