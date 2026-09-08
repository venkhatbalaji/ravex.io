package domain

// Pool is the pari-mutuel aggregate for a single market: how many coins are
// staked on each outcome, and the business rules for adding to and settling it.
type Pool struct {
	MarketID string
	Totals   map[string]int64 // outcomeID -> total staked
}

func NewPool(marketID string) *Pool {
	return &Pool{MarketID: marketID, Totals: make(map[string]int64)}
}

func (p *Pool) AddStake(outcomeID string, amount int64) error {
	if amount <= 0 {
		return ErrInvalidAmount
	}
	p.Totals[outcomeID] += amount
	return nil
}

func (p *Pool) GrandTotal() int64 {
	var total int64
	for _, v := range p.Totals {
		total += v
	}
	return total
}

func (p *Pool) ImpliedOdds() map[string]float64 {
	grand := p.GrandTotal()
	odds := make(map[string]float64, len(p.Totals))
	for outcome, v := range p.Totals {
		if grand > 0 {
			odds[outcome] = float64(v) / float64(grand)
		} else {
			odds[outcome] = 0
		}
	}
	return odds
}

func (p *Pool) Settle(winningOutcomeID string) (SettlementResult, error) {
	winningTotal, ok := p.Totals[winningOutcomeID]
	if !ok || winningTotal == 0 {
		return SettlementResult{}, ErrNoStakesOnOutcome
	}

	grand := p.GrandTotal()
	return SettlementResult{
		MarketID:         p.MarketID,
		WinningOutcomeID: winningOutcomeID,
		TotalPool:        grand,
		WinningPool:      winningTotal,
		PayoutRatio:      float64(grand) / float64(winningTotal),
	}, nil
}

// Clone returns a value-safe copy, so callers outside the store's lock can't
// mutate pool state they only asked to read.
func (p *Pool) Clone() *Pool {
	clone := NewPool(p.MarketID)
	for k, v := range p.Totals {
		clone.Totals[k] = v
	}
	return clone
}

type SettlementResult struct {
	MarketID         string  `json:"marketId"`
	WinningOutcomeID string  `json:"winningOutcomeId"`
	TotalPool        int64   `json:"totalPool"`
	WinningPool      int64   `json:"winningPool"`
	PayoutRatio      float64 `json:"payoutRatio"`
}
