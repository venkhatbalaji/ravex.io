package domain

import (
	"math"
	"math/rand"
	"reflect"
	"testing"
)

func TestResolutionAllocation(t *testing.T) {
	market := Market{ID: "market", Status: "settling", WinningOutcomeID: "home"}
	stakes := []Stake{{ID: "a", UserID: "u1", OutcomeID: "home", Amount: 2}, {ID: "b", UserID: "u2", OutcomeID: "home", Amount: 3}, {ID: "c", UserID: "u3", OutcomeID: "away", Amount: 6}}
	result, err := BuildResolution(market, stakes)
	if err != nil {
		t.Fatal(err)
	}
	if result.Total != 11 || result.Payouts[0].Amount != 4 || result.Payouts[1].Amount != 7 || result.Payouts[2].Amount != 0 {
		t.Fatalf("wrong allocation: %+v", result)
	}
	market.WinningOutcomeID = "unbacked"
	result, err = BuildResolution(market, stakes)
	if err != nil || result.Kind != "refund" {
		t.Fatalf("unbacked winner: %+v %v", result, err)
	}
	for i, p := range result.Payouts {
		if p.Amount != stakes[i].Amount {
			t.Fatal("refund changed stake amount")
		}
	}
	market.Status = "refunding"
	market.WinningOutcomeID = ""
	result, err = BuildResolution(market, stakes)
	if err != nil || !result.Cancelled || result.Kind != "refund" {
		t.Fatalf("cancel: %+v %v", result, err)
	}
}
func TestResolutionRemainderTieAndLargeInteger(t *testing.T) {
	m := Market{Status: "settling", WinningOutcomeID: "win"}
	s := []Stake{{ID: "b", OutcomeID: "win", Amount: 1}, {ID: "a", OutcomeID: "win", Amount: 1}, {ID: "c", OutcomeID: "lose", Amount: 1}}
	p, err := BuildResolution(m, s)
	if err != nil {
		t.Fatal(err)
	}
	if p.Payouts[0].StakeID != "a" || p.Payouts[0].Amount != 2 || p.Payouts[1].Amount != 1 {
		t.Fatalf("tie is not deterministic: %+v", p)
	}
	s = []Stake{{ID: "a", OutcomeID: "win", Amount: math.MaxInt64 - 1}, {ID: "b", OutcomeID: "lose", Amount: 1}}
	p, err = BuildResolution(m, s)
	if err != nil || p.Payouts[0].Amount != math.MaxInt64 {
		t.Fatalf("large integer allocation: %+v %v", p, err)
	}
	s[1].Amount = 2
	if _, err = BuildResolution(m, s); err == nil {
		t.Fatal("overflowing total accepted")
	}
}
func TestResolutionConservationAndOrderIndependence(t *testing.T) {
	rng := rand.New(rand.NewSource(72))
	for run := 0; run < 300; run++ {
		m := Market{Status: "settling", WinningOutcomeID: "win"}
		s := []Stake{}
		for i := 0; i < 20; i++ {
			outcome := "lose"
			if rng.Intn(2) == 0 {
				outcome = "win"
			}
			s = append(s, Stake{ID: string(rune('a' + i)), OutcomeID: outcome, Amount: int64(rng.Intn(100000) + 1)})
		}
		expected, err := BuildResolution(m, s)
		if err != nil {
			t.Fatal(err)
		}
		total := int64(0)
		for _, p := range expected.Payouts {
			if p.Amount < 0 {
				t.Fatal("negative payout")
			}
			total += p.Amount
		}
		if total != expected.Total {
			t.Fatal("coins lost or created")
		}
		rng.Shuffle(len(s), func(i, j int) { s[i], s[j] = s[j], s[i] })
		actual, err := BuildResolution(m, s)
		if err != nil || !reflect.DeepEqual(expected, actual) {
			t.Fatal("plan depends on database row order")
		}
	}
}
