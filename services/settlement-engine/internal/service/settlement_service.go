package service

import (
	"context"
	"errors"
	"github.com/google/uuid"
	"log"
	"ravex/settlement-engine/internal/domain"
	"time"
)

type SettlementService struct {
	repo    domain.StakeRepository
	wallet  domain.WalletClient
	markets domain.MarketClient
}

func NewSettlementService(repo domain.StakeRepository, wallet domain.WalletClient, markets domain.MarketClient) *SettlementService {
	return &SettlementService{repo, wallet, markets}
}

func (s *SettlementService) PlaceStake(ctx context.Context, userID, key, marketID, outcomeID string, amount int64) (*domain.Stake, error) {
	if amount <= 0 {
		return nil, domain.ErrInvalidAmount
	}
	proposed := domain.Stake{ID: uuid.NewString(), UserID: userID, IdempotencyKey: key, MarketID: marketID, OutcomeID: outcomeID, Amount: amount}
	stake, err := s.repo.Find(ctx, userID, key)
	if err != nil {
		return nil, err
	}
	if stake != nil && !stake.Matches(proposed) {
		return nil, domain.ErrIdempotencyConflict
	}
	if stake == nil {
		market, err := s.markets.GetMarket(ctx, marketID)
		if err != nil {
			return nil, err
		}
		stake, err = s.repo.Admit(ctx, proposed, market)
		if err != nil {
			return nil, err
		}
	}
	// A retry of an admitted request must work after cutoff and closure.
	if stake.State == domain.StakePending {
		if err = s.process(ctx, *stake); err != nil {
			// The durable intent is enough for recovery. A dependency failure
			// must not be presented as a rejected stake or invite a new key.
			log.Printf("stake %s remains pending: %v", stake.ID, err)
			return stake, nil
		}
		stake, err = s.repo.Find(ctx, userID, key)
		if err != nil {
			return nil, err
		}
	}
	if stake.State == domain.StakeRejected {
		return stake, domain.ErrInsufficientBalance
	}
	return stake, nil
}

func (s *SettlementService) process(ctx context.Context, stake domain.Stake) error {
	if err := s.repo.Touch(ctx, stake.ID); err != nil {
		return err
	}
	err := s.wallet.DebitStake(ctx, stake)
	state := domain.StakeAccepted
	if errors.Is(err, domain.ErrInsufficientBalance) {
		state = domain.StakeRejected
	} else if err != nil {
		return err
	}
	return s.repo.Complete(ctx, stake.ID, state)
}

func (s *SettlementService) Recover(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		stakes, err := s.repo.Pending(ctx, 100)
		if err != nil && ctx.Err() == nil {
			log.Printf("load pending stakes: %v", err)
		}
		for _, stake := range stakes {
			if ctx.Err() != nil {
				return
			}
			if err := s.process(ctx, stake); err != nil && ctx.Err() == nil {
				log.Printf("recover stake %s: %v", stake.ID, err)
			}
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
func (s *SettlementService) GetPool(ctx context.Context, id string) (*domain.Pool, error) {
	return s.repo.Snapshot(ctx, id, false)
}
func (s *SettlementService) Close(ctx context.Context, id string) error { return s.repo.Close(ctx, id) }
func (s *SettlementService) Settle(ctx context.Context, id, winner string) (domain.SettlementResult, error) {
	pool, err := s.repo.Snapshot(ctx, id, true)
	if err != nil {
		return domain.SettlementResult{}, err
	}
	return pool.Settle(winner)
}
