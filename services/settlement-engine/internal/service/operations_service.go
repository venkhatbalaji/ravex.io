package service

import (
	"context"
	"ravex/settlement-engine/internal/domain"
)

type OperationsService struct{ repo domain.OperationsRepository }

func NewOperationsService(repo domain.OperationsRepository) *OperationsService {
	return &OperationsService{repo}
}
func (s *OperationsService) Snapshot(ctx context.Context, limit, offset int) (*domain.Operations, error) {
	return s.repo.Operations(ctx, limit, offset)
}
func (s *OperationsService) Ready(ctx context.Context) error { return s.repo.Ready(ctx) }
