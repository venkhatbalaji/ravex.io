CREATE TABLE settlement.resolutions (
    market_id uuid PRIMARY KEY REFERENCES settlement.market_gates(market_id),
    plan jsonb NOT NULL,
    completed boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX resolutions_pending ON settlement.resolutions(updated_at) WHERE NOT completed;
