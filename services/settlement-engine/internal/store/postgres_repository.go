package store

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"time"

	_ "github.com/lib/pq"
	"ravex/settlement-engine/internal/domain"
)

//go:embed migrations/*.sql
var migrations embed.FS

type PostgresRepository struct{ db *sql.DB }

func Open(ctx context.Context, connection string) (*PostgresRepository, error) {
	db, err := sql.Open("postgres", connection)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(15)
	db.SetMaxIdleConns(5)
	repo := &PostgresRepository{db: db}
	if err = db.PingContext(ctx); err == nil {
		err = repo.migrate(ctx)
	}
	if err != nil {
		db.Close()
		return nil, err
	}
	return repo, nil
}

func (r *PostgresRepository) Shutdown() error { return r.db.Close() }

func (r *PostgresRepository) migrate(ctx context.Context) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended('settlement:migrations', 0))"); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `CREATE SCHEMA IF NOT EXISTS settlement;
        CREATE TABLE IF NOT EXISTS settlement.schema_migrations (name text PRIMARY KEY)`); err != nil {
		return err
	}
	entries, err := migrations.ReadDir("migrations")
	if err != nil {
		return err
	}
	for _, entry := range entries {
		var applied bool
		if err = tx.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM settlement.schema_migrations WHERE name=$1)", entry.Name()).Scan(&applied); err != nil {
			return err
		}
		if applied {
			continue
		}
		migration, err := migrations.ReadFile("migrations/" + entry.Name())
		if err != nil {
			return err
		}
		if _, err = tx.ExecContext(ctx, string(migration)); err != nil {
			return fmt.Errorf("migration %s: %w", entry.Name(), err)
		}
		if _, err = tx.ExecContext(ctx, "INSERT INTO settlement.schema_migrations (name) VALUES ($1)", entry.Name()); err != nil {
			return err
		}
	}
	return tx.Commit()
}

const stakeColumns = "id, user_id, idempotency_key, market_id, outcome_id, amount, state, created_at, updated_at"

type scanner interface{ Scan(...any) error }

func scanStake(row scanner) (*domain.Stake, error) {
	var s domain.Stake
	err := row.Scan(&s.ID, &s.UserID, &s.IdempotencyKey, &s.MarketID, &s.OutcomeID, &s.Amount, &s.State, &s.CreatedAt, &s.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *PostgresRepository) Find(ctx context.Context, user, key string) (*domain.Stake, error) {
	return scanStake(r.db.QueryRowContext(ctx, "SELECT "+stakeColumns+" FROM settlement.stakes WHERE user_id=$1 AND idempotency_key=$2", user, key))
}

func (r *PostgresRepository) Admit(ctx context.Context, stake domain.Stake, market domain.Market) (*domain.Stake, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	// Serialize key reuse even when the conflicting request targets another market.
	if _, err = tx.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", stake.UserID+":"+stake.IdempotencyKey); err != nil {
		return nil, err
	}
	previous, err := scanStake(tx.QueryRowContext(ctx, "SELECT "+stakeColumns+" FROM settlement.stakes WHERE user_id=$1 AND idempotency_key=$2", stake.UserID, stake.IdempotencyKey))
	if err != nil {
		return nil, err
	}
	if previous != nil {
		if !previous.Matches(stake) {
			return nil, domain.ErrIdempotencyConflict
		}
		return previous, nil
	}
	// Check eligibility under the idempotency lock, after checking for an
	// existing intent. A concurrent retry must observe that intent even if
	// its catalog read happened just as the market closed.
	if err = market.ValidateStake(stake.OutcomeID, time.Now()); err != nil {
		return nil, err
	}
	if _, err = tx.ExecContext(ctx, "INSERT INTO settlement.market_gates (market_id) VALUES ($1) ON CONFLICT DO NOTHING", stake.MarketID); err != nil {
		return nil, err
	}
	var closed bool
	if err = tx.QueryRowContext(ctx, "SELECT closed FROM settlement.market_gates WHERE market_id=$1 FOR UPDATE", stake.MarketID).Scan(&closed); err != nil {
		return nil, err
	}
	var beforeCutoff bool
	if err = tx.QueryRowContext(ctx, "SELECT clock_timestamp() < $1", market.EventStartAt).Scan(&beforeCutoff); err != nil {
		return nil, err
	}
	if closed || !beforeCutoff {
		return nil, domain.ErrMarketClosed
	}
	saved, err := scanStake(tx.QueryRowContext(ctx, "INSERT INTO settlement.stakes (id,user_id,idempotency_key,market_id,outcome_id,amount) VALUES ($1,$2,$3,$4,$5,$6) RETURNING "+stakeColumns, stake.ID, stake.UserID, stake.IdempotencyKey, stake.MarketID, stake.OutcomeID, stake.Amount))
	if err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return saved, nil
}

func (r *PostgresRepository) Complete(ctx context.Context, id, state string) error {
	if state != domain.StakeAccepted && state != domain.StakeRejected {
		return errors.New("invalid terminal stake state")
	}
	result, err := r.db.ExecContext(ctx, "UPDATE settlement.stakes SET state=$2, updated_at=clock_timestamp() WHERE id=$1 AND (state='pending' OR state=$2)", id, state)
	if err != nil {
		return err
	}
	count, err := result.RowsAffected()
	if err == nil && count != 1 {
		return errors.New("stake missing or conflicting terminal decision")
	}
	return err
}

func (r *PostgresRepository) Touch(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE settlement.stakes SET updated_at=clock_timestamp() WHERE id=$1 AND state='pending'", id)
	return err
}

func (r *PostgresRepository) Pending(ctx context.Context, limit int) ([]domain.Stake, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT "+stakeColumns+" FROM settlement.stakes WHERE state='pending' ORDER BY updated_at,id LIMIT $1", limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	stakes := []domain.Stake{}
	for rows.Next() {
		stake, err := scanStake(rows)
		if err != nil {
			return nil, err
		}
		stakes = append(stakes, *stake)
	}
	return stakes, rows.Err()
}

// Close persists the gate even when it reports pending work. Previously
// admitted stakes may finish; every new admission will now be rejected.
func (r *PostgresRepository) Close(ctx context.Context, market string) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO settlement.market_gates (market_id,closed) VALUES ($1,true)
        ON CONFLICT (market_id) DO UPDATE SET closed=true`, market)
	if err != nil {
		return err
	}
	var pending bool
	err = r.db.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM settlement.stakes WHERE market_id=$1 AND state='pending')", market).Scan(&pending)
	if err != nil {
		return err
	}
	if pending {
		return domain.ErrPendingStakes
	}
	return nil
}

func (r *PostgresRepository) Snapshot(ctx context.Context, market string, final bool) (*domain.Pool, error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	if final {
		var closed, pending bool
		if err = tx.QueryRowContext(ctx, `SELECT
            EXISTS (SELECT 1 FROM settlement.market_gates WHERE market_id=$1 AND closed),
            EXISTS (SELECT 1 FROM settlement.stakes WHERE market_id=$1 AND state='pending')`, market).Scan(&closed, &pending); err != nil {
			return nil, err
		}
		if !closed {
			return nil, domain.ErrAdmissionOpen
		}
		if pending {
			return nil, domain.ErrPendingStakes
		}
	}
	rows, err := tx.QueryContext(ctx, "SELECT outcome_id, SUM(amount)::bigint FROM settlement.stakes WHERE market_id=$1 AND state='accepted' GROUP BY outcome_id", market)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	pool := domain.NewPool(market)
	for rows.Next() {
		var outcome string
		var amount int64
		if err = rows.Scan(&outcome, &amount); err != nil {
			return nil, err
		}
		pool.Totals[outcome] = amount
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return pool, tx.Commit()
}
