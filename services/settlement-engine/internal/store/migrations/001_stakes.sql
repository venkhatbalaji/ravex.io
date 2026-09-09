CREATE SCHEMA IF NOT EXISTS settlement;
CREATE TABLE settlement.market_gates (
    market_id uuid PRIMARY KEY,
    closed boolean NOT NULL DEFAULT false
);
CREATE TABLE settlement.stakes (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL,
    idempotency_key uuid NOT NULL,
    market_id uuid NOT NULL REFERENCES settlement.market_gates(market_id),
    outcome_id uuid NOT NULL,
    amount bigint NOT NULL CHECK (amount > 0),
    state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'accepted', 'rejected')),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (user_id, idempotency_key)
);
CREATE INDEX stakes_pool ON settlement.stakes (market_id, outcome_id) WHERE state = 'accepted';
CREATE INDEX stakes_recovery ON settlement.stakes (updated_at, id) WHERE state = 'pending';
CREATE INDEX stakes_player ON settlement.stakes (user_id, created_at DESC);
