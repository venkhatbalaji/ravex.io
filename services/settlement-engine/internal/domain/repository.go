package domain

// PoolRepository is the port the service layer depends on — swapping the
// in-memory store for a Postgres- or Redis-backed one later means writing a
// new adapter, not touching the service or transport layers.
type PoolRepository interface {
	AddStake(marketID, outcomeID string, amount int64) (*Pool, error)
	Snapshot(marketID string) *Pool
	Settle(marketID, winningOutcomeID string) (SettlementResult, error)
}
