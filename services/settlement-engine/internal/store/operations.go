package store

import (
	"context"
	"database/sql"
	"ravex/settlement-engine/internal/domain"
)

func (r *PostgresRepository) Operations(ctx context.Context, limit, offset int) (*domain.Operations, error) {
	// Counts and rows describe the same snapshot even while recovery completes.
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	result := &domain.Operations{Items: []domain.PendingOperation{}}
	err = tx.QueryRowContext(ctx, `SELECT transaction_timestamp(),
 (SELECT count(*) FROM settlement.stakes WHERE state='pending'),
 (SELECT count(*) FROM settlement.resolutions WHERE NOT completed),
 (SELECT min(created_at) FROM (
 SELECT created_at FROM settlement.stakes WHERE state='pending'
 UNION ALL SELECT created_at FROM settlement.resolutions WHERE NOT completed) pending)`).Scan(
		&result.ObservedAt, &result.PendingDebits, &result.PendingResolutions, &result.OldestPendingAt)
	if err != nil {
		return nil, err
	}
	rows, err := tx.QueryContext(ctx, `SELECT id,market_id,kind,amount,created_at,updated_at FROM (
 SELECT id,market_id,'debit' AS kind,amount,created_at,updated_at FROM settlement.stakes WHERE state='pending'
 UNION ALL
 SELECT market_id,market_id,plan->>'kind',(plan->>'total')::bigint,created_at,updated_at
 FROM settlement.resolutions WHERE NOT completed) pending
 ORDER BY created_at,id,kind LIMIT $1 OFFSET $2`, limit+1, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var item domain.PendingOperation
		if err = rows.Scan(&item.ID, &item.MarketID, &item.Kind, &item.Amount, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		result.Items = append(result.Items, item)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	if len(result.Items) > limit {
		n := offset + limit
		result.NextOffset = &n
		result.Items = result.Items[:limit]
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return result, nil
}
