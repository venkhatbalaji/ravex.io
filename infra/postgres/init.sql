CREATE TABLE IF NOT EXISTS inquiries (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(180) NOT NULL,
  service VARCHAR(40) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS inquiries_created_at_idx ON inquiries (created_at DESC);

