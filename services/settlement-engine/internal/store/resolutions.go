package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"ravex/settlement-engine/internal/domain"
)

func readResolution(row scanner) (*domain.Resolution, error) {
	var body []byte
	var completed bool
	if err := row.Scan(&body, &completed); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	var result domain.Resolution
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	result.Completed = completed
	return &result, nil
}
func (r *PostgresRepository) Plan(ctx context.Context, market domain.Market) (*domain.Resolution, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var closed bool
	if err = tx.QueryRowContext(ctx, "SELECT closed FROM settlement.market_gates WHERE market_id=$1 FOR UPDATE", market.ID).Scan(&closed); err != nil {
		return nil, err
	}
	if !closed {
		return nil, domain.ErrAdmissionOpen
	}
	previous, err := readResolution(tx.QueryRowContext(ctx, "SELECT plan,completed FROM settlement.resolutions WHERE market_id=$1", market.ID))
	if err != nil {
		return nil, err
	}
	if previous != nil {
		cancelled := market.Status == "refunding" || market.Status == "cancelled"
		if previous.WinningOutcomeID != market.WinningOutcomeID || previous.Cancelled != cancelled {
			return nil, domain.ErrResolutionConflict
		}
		return previous, nil
	}
	var pending bool
	if err = tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM settlement.stakes WHERE market_id=$1 AND state='pending')", market.ID).Scan(&pending); err != nil {
		return nil, err
	}
	if pending {
		return nil, domain.ErrPendingStakes
	}
	rows, err := tx.QueryContext(ctx, "SELECT "+stakeColumns+" FROM settlement.stakes WHERE market_id=$1 AND state='accepted' ORDER BY id", market.ID)
	if err != nil {
		return nil, err
	}
	stakes := []domain.Stake{}
	for rows.Next() {
		s, err := scanStake(rows)
		if err != nil {
			rows.Close()
			return nil, err
		}
		stakes = append(stakes, *s)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	plan, err := domain.BuildResolution(market, stakes)
	if err != nil {
		return nil, err
	}
	body, err := json.Marshal(plan)
	if err != nil {
		return nil, err
	}
	if _, err = tx.ExecContext(ctx, "INSERT INTO settlement.resolutions (market_id,plan) VALUES ($1,$2)", market.ID, string(body)); err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return plan, nil
}
func (r *PostgresRepository) FinishResolution(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE settlement.resolutions SET completed=true,updated_at=clock_timestamp() WHERE market_id=$1", id)
	return err
}
func (r *PostgresRepository) PendingResolutions(ctx context.Context) ([]domain.Resolution, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT plan,completed FROM settlement.resolutions WHERE NOT completed ORDER BY updated_at LIMIT 50")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []domain.Resolution{}
	for rows.Next() {
		plan, err := readResolution(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *plan)
	}
	return items, rows.Err()
}
func (r *PostgresRepository) TouchResolution(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE settlement.resolutions SET updated_at=clock_timestamp() WHERE market_id=$1 AND NOT completed", id)
	return err
}
func (r *PostgresRepository) Predictions(ctx context.Context, user string, limit, offset int) ([]domain.Prediction, error) {
	// Limit before joining resolution plans, and never accept the player ID
	// from request parameters: it comes from the validated Identity response.
	rows, err := r.db.QueryContext(ctx, `SELECT s.id,s.market_id,s.outcome_id,s.amount,s.state,s.created_at,s.updated_at,
        COALESCE(r.plan->>'kind',''),COALESCE(r.plan->>'winningOutcomeId',''),COALESCE(r.completed,false),
        COALESCE((SELECT (p->>'amount')::bigint FROM jsonb_array_elements(r.plan->'payouts') p WHERE p->>'stakeId'=s.id::text),0)
        FROM settlement.stakes s LEFT JOIN settlement.resolutions r ON r.market_id=s.market_id
        WHERE s.user_id=$1 ORDER BY s.created_at DESC,s.id LIMIT $2 OFFSET $3`, user, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []domain.Prediction{}
	for rows.Next() {
		var p domain.Prediction
		var kind, winner string
		var completed bool
		var payout int64
		if err = rows.Scan(&p.ID, &p.MarketID, &p.OutcomeID, &p.Amount, &p.State, &p.CreatedAt, &p.UpdatedAt, &kind, &winner, &completed, &payout); err != nil {
			return nil, err
		}
		p.Result = p.State
		if p.State == domain.StakeAccepted {
			p.Result = "active"
			if kind != "" {
				p.Result = "processing"
			}
			if completed {
				p.Payout = payout
				p.Result = "lost"
				if kind == "refund" {
					p.Result = "refunded"
				} else if winner == p.OutcomeID {
					p.Result = "won"
				}
			}
		}
		items = append(items, p)
	}
	return items, rows.Err()
}
