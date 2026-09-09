-- Backend microservices each own a schema in the same local `ravex` database.
-- One schema per service keeps data ownership boundaries real even though
-- everything happens to share one Postgres container in local dev.
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS wallet;
CREATE SCHEMA IF NOT EXISTS market_catalog;
CREATE SCHEMA IF NOT EXISTS settlement;
CREATE SCHEMA IF NOT EXISTS branding;
