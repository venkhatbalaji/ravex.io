package service

import (
	"context"

	"ravex/settlement-engine/internal/domain"
)

// SettlementService is the use-case layer: it depends on the PoolRepository
// and WalletClient ports, never on concrete adapters, so the transport layer
// never needs to know how (or where) pools are kept or balances are moved.
type SettlementService struct {
	repo   domain.PoolRepository
	wallet domain.WalletClient
}

func NewSettlementService(repo domain.PoolRepository, wallet domain.WalletClient) *SettlementService {
	return &SettlementService{repo: repo, wallet: wallet}
}

// PlaceStake debits the player's wallet first — amount is only valid once
// Wallet has confirmed it, so a pool never holds a stake nobody actually paid for.
func (s *SettlementService) PlaceStake(ctx context.Context, bearerToken, marketID, outcomeID string, amount int64) (*domain.Pool, error) {
	if err := s.wallet.DebitStake(ctx, bearerToken, marketID, outcomeID, amount); err != nil {
		return nil, err
	}
	return s.repo.AddStake(marketID, outcomeID, amount)
}

func (s *SettlementService) GetPool(marketID string) *domain.Pool {
	return s.repo.Snapshot(marketID)
}

func (s *SettlementService) Settle(marketID, winningOutcomeID string) (domain.SettlementResult, error) {
	return s.repo.Settle(marketID, winningOutcomeID)
}
