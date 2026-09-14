-- Existing plans lack creation time. Preserve their last recorded timestamp as
-- an approximation; new plans retain their real creation time across retries.
ALTER TABLE settlement.resolutions ADD COLUMN created_at timestamptz;
UPDATE settlement.resolutions SET created_at = updated_at;
ALTER TABLE settlement.resolutions ALTER COLUMN created_at SET DEFAULT clock_timestamp();
ALTER TABLE settlement.resolutions ALTER COLUMN created_at SET NOT NULL;
CREATE INDEX resolutions_pending_age ON settlement.resolutions(created_at, market_id) WHERE NOT completed;
CREATE INDEX stakes_pending_age ON settlement.stakes(created_at, id) WHERE state = 'pending';
