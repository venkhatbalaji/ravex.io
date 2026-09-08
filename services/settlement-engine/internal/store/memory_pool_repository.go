package store

import (
	"sync"

	"ravex/settlement-engine/internal/domain"
)

// MemoryPoolRepository is the local-dev adapter for domain.PoolRepository.
// All mutation happens under one mutex here — Pool itself stays lock-free
// so the concurrency concern lives in the adapter, not the domain model.
type MemoryPoolRepository struct {
	mu    sync.Mutex
	pools map[string]*domain.Pool
}

func NewMemoryPoolRepository() *MemoryPoolRepository {
	return &MemoryPoolRepository{pools: make(map[string]*domain.Pool)}
}

func (r *MemoryPoolRepository) pool(marketID string) *domain.Pool {
	pool, ok := r.pools[marketID]
	if !ok {
		pool = domain.NewPool(marketID)
		r.pools[marketID] = pool
	}
	return pool
}

func (r *MemoryPoolRepository) AddStake(marketID, outcomeID string, amount int64) (*domain.Pool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	pool := r.pool(marketID)
	if err := pool.AddStake(outcomeID, amount); err != nil {
		return nil, err
	}
	return pool.Clone(), nil
}

func (r *MemoryPoolRepository) Snapshot(marketID string) *domain.Pool {
	r.mu.Lock()
	defer r.mu.Unlock()

	return r.pool(marketID).Clone()
}

func (r *MemoryPoolRepository) Settle(marketID, winningOutcomeID string) (domain.SettlementResult, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	return r.pool(marketID).Settle(winningOutcomeID)
}
