package service

import (
	"context"
	"log"
	"ravex/settlement-engine/internal/domain"
	"time"
)

type ResolutionService struct {
	repo    domain.ResolutionRepository
	wallet  domain.PayoutClient
	markets domain.MarketClient
}

func NewResolutionService(repo domain.ResolutionRepository, wallet domain.PayoutClient, markets domain.MarketClient) *ResolutionService {
	return &ResolutionService{repo, wallet, markets}
}
func (s *ResolutionService) Resolve(ctx context.Context, id string) (*domain.Resolution, error) {
	market, err := s.markets.GetMarket(ctx, id)
	if err != nil {
		return nil, err
	}
	if market.Status != "settling" && market.Status != "refunding" && market.Status != "settled" && market.Status != "cancelled" {
		return nil, domain.ErrResolutionConflict
	}
	plan, err := s.repo.Plan(ctx, market)
	if err != nil {
		return nil, err
	}
	if !plan.Completed {
		if err = s.pay(ctx, *plan); err != nil {
			log.Printf("resolution %s pending: %v", id, err)
			return plan, nil
		}
		plan.Completed = true
	}
	return plan, nil
}
func (s *ResolutionService) pay(ctx context.Context, plan domain.Resolution) error {
	if err := s.repo.TouchResolution(ctx, plan.MarketID); err != nil {
		return err
	}
	if err := s.wallet.PayResolution(ctx, plan); err != nil {
		return err
	}
	return s.repo.FinishResolution(ctx, plan.MarketID)
}
func (s *ResolutionService) Recover(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		plans, err := s.repo.PendingResolutions(ctx)
		if err != nil && ctx.Err() == nil {
			log.Printf("resolution scan: %v", err)
		}
		for _, plan := range plans {
			if ctx.Err() != nil {
				return
			}
			if err = s.pay(ctx, plan); err != nil && ctx.Err() == nil {
				log.Printf("resolution %s recovery: %v", plan.MarketID, err)
			}
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
func (s *ResolutionService) Predictions(ctx context.Context, user string, limit, offset int) ([]domain.Prediction, error) {
	return s.repo.Predictions(ctx, user, limit, offset)
}
