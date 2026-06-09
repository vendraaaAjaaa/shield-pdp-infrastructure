-- Minimal Shield-PDP lab schema for remote PostgreSQL.
-- This file is intentionally non-destructive and safe to rerun.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  hashed_password VARCHAR(256) NOT NULL,
  role VARCHAR(32),
  customer_id VARCHAR(64),
  is_admin INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_users_username ON users (username);
CREATE INDEX IF NOT EXISTS ix_users_customer_id ON users (customer_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id VARCHAR(64);

CREATE TABLE IF NOT EXISTS profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
  profile_id VARCHAR(64),
  customer_id VARCHAR(64),
  full_name VARCHAR(128) NOT NULL,
  nik VARCHAR(32) NOT NULL,
  biometric_sample TEXT,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(32) NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_profiles_user_id ON profiles (user_id);
CREATE INDEX IF NOT EXISTS ix_profiles_profile_id ON profiles (profile_id);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_id VARCHAR(64);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS customer_id VARCHAR(64);

CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  account_id VARCHAR(64),
  account_number VARCHAR(32) UNIQUE NOT NULL,
  balance DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  currency VARCHAR(8),
  account_type VARCHAR(64),
  account_name VARCHAR(128),
  bank_name VARCHAR(128),
  status VARCHAR(32),
  classification VARCHAR(64),
  last_activity_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_accounts_owner_id ON accounts (owner_id);
CREATE INDEX IF NOT EXISTS ix_accounts_account_number ON accounts (account_number);
CREATE INDEX IF NOT EXISTS ix_accounts_account_id ON accounts (account_id);

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_id VARCHAR(64);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS currency VARCHAR(8);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_type VARCHAR(64);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_name VARCHAR(128);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS bank_name VARCHAR(128);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS status VARCHAR(32);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS classification VARCHAR(64);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS audit_events (
  id SERIAL PRIMARY KEY,
  audit_event_id VARCHAR(64),
  event_type VARCHAR(64) NOT NULL,
  actor_user_id INTEGER,
  actor_username VARCHAR(64),
  actor_role VARCHAR(32),
  action VARCHAR(128),
  method VARCHAR(16),
  path VARCHAR(256),
  target_type VARCHAR(64),
  target_id VARCHAR(64),
  resource_type VARCHAR(64),
  resource_id VARCHAR(128),
  target_owner_id VARCHAR(64),
  authenticated_owner_id VARCHAR(64),
  outcome VARCHAR(32) NOT NULL,
  result VARCHAR(32),
  status_code INTEGER,
  risk VARCHAR(32),
  pdp_relevant INTEGER,
  personal_data_accessed INTEGER,
  request_id VARCHAR(64),
  correlation_id VARCHAR(64),
  user_agent TEXT,
  source_ip VARCHAR(64),
  ip_address VARCHAR(64),
  evidence_id VARCHAR(64),
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_audit_events_event_type ON audit_events (event_type);
CREATE INDEX IF NOT EXISTS ix_audit_events_request_id ON audit_events (request_id);
CREATE INDEX IF NOT EXISTS ix_audit_events_audit_event_id ON audit_events (audit_event_id);

ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS audit_event_id VARCHAR(64);
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS actor_role VARCHAR(32);
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS action VARCHAR(128);
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS method VARCHAR(16);
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS path VARCHAR(256);
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS resource_type VARCHAR(64);
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS resource_id VARCHAR(128);
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS target_owner_id VARCHAR(64);
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS authenticated_owner_id VARCHAR(64);
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS result VARCHAR(32);
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS status_code INTEGER;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS risk VARCHAR(32);
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS pdp_relevant INTEGER;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS personal_data_accessed INTEGER;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(64);
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS source_ip VARCHAR(64);
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS evidence_id VARCHAR(64);

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  transaction_id VARCHAR(64),
  transaction_ref VARCHAR(64) UNIQUE NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  direction VARCHAR(16) NOT NULL CHECK (direction IN ('credit', 'debit')),
  status VARCHAR(24) NOT NULL DEFAULT 'posted',
  merchant VARCHAR(128),
  category VARCHAR(128),
  channel VARCHAR(64),
  risk VARCHAR(32),
  risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  suspicious_reason TEXT,
  transfer_id VARCHAR(64),
  counterparty VARCHAR(128),
  note TEXT,
  occurred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_transactions_account_id ON transactions (account_id);
CREATE INDEX IF NOT EXISTS ix_transactions_transaction_id ON transactions (transaction_id);
CREATE INDEX IF NOT EXISTS ix_transactions_created_at ON transactions (created_at);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(64);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category VARCHAR(128);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS channel VARCHAR(64);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS risk VARCHAR(32);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS suspicious_reason TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transfer_id VARCHAR(64);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS counterparty VARCHAR(128);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS ix_transactions_transfer_id ON transactions (transfer_id);

CREATE TABLE IF NOT EXISTS transfers (
  id SERIAL PRIMARY KEY,
  transfer_id VARCHAR(64) UNIQUE NOT NULL,
  authenticated_user_id INTEGER NOT NULL REFERENCES users(id),
  source_account_id VARCHAR(64) NOT NULL,
  destination_account_id VARCHAR(64) NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'IDR',
  note TEXT,
  simulation_only INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'simulated',
  risk VARCHAR(32) NOT NULL DEFAULT 'high',
  source_owner_id INTEGER,
  initiated_by_username VARCHAR(64),
  source_owner_customer_id VARCHAR(64),
  destination_owner_customer_id VARCHAR(64),
  vulnerable_mode INTEGER NOT NULL DEFAULT 1,
  idor_detected INTEGER NOT NULL DEFAULT 0,
  source_transaction_id VARCHAR(64),
  destination_transaction_id VARCHAR(64),
  source_balance_before DOUBLE PRECISION,
  source_balance_after DOUBLE PRECISION,
  destination_balance_before DOUBLE PRECISION,
  destination_balance_after DOUBLE PRECISION,
  idempotency_key VARCHAR(128),
  evidence_id VARCHAR(64),
  audit_event_id VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_transfers_transfer_id ON transfers (transfer_id);
CREATE INDEX IF NOT EXISTS ix_transfers_authenticated_user_id ON transfers (authenticated_user_id);
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS initiated_by_username VARCHAR(64);
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS source_owner_customer_id VARCHAR(64);
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS destination_owner_customer_id VARCHAR(64);
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS vulnerable_mode INTEGER DEFAULT 1;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS idor_detected INTEGER DEFAULT 0;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS source_transaction_id VARCHAR(64);
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS destination_transaction_id VARCHAR(64);
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS source_balance_before DOUBLE PRECISION;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS source_balance_after DOUBLE PRECISION;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS destination_balance_before DOUBLE PRECISION;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS destination_balance_after DOUBLE PRECISION;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);
CREATE UNIQUE INDEX IF NOT EXISTS ix_transfers_idempotency_key ON transfers (idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS pentest_evidence (
  id SERIAL PRIMARY KEY,
  evidence_id VARCHAR(64) UNIQUE NOT NULL,
  finding_id VARCHAR(64) NOT NULL,
  vulnerability_type VARCHAR(128) NOT NULL,
  severity VARCHAR(32) NOT NULL,
  cvss DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  affected_endpoint VARCHAR(256) NOT NULL,
  affected_object VARCHAR(128),
  authenticated_user VARCHAR(64),
  target_owner VARCHAR(64),
  business_impact TEXT NOT NULL,
  pdp_impact TEXT NOT NULL,
  request_summary TEXT NOT NULL,
  response_summary TEXT NOT NULL,
  remediation TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_pentest_evidence_evidence_id ON pentest_evidence (evidence_id);
CREATE INDEX IF NOT EXISTS ix_pentest_evidence_finding_id ON pentest_evidence (finding_id);

CREATE TABLE IF NOT EXISTS segmentation_evidence (
  id SERIAL PRIMARY KEY,
  evidence_id VARCHAR(64) UNIQUE NOT NULL,
  db_zone VARCHAR(128) NOT NULL,
  app_zone VARCHAR(128) NOT NULL,
  database_host VARCHAR(64) NOT NULL,
  allowed_client VARCHAR(64) NOT NULL,
  transport VARCHAR(64) NOT NULL,
  postgres_listen_policy TEXT NOT NULL,
  public_listen INTEGER NOT NULL DEFAULT 0,
  firewall_policy TEXT NOT NULL,
  segmentation_status VARCHAR(32) NOT NULL,
  risk VARCHAR(32) NOT NULL,
  pdp_impact TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_segmentation_evidence_evidence_id ON segmentation_evidence (evidence_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(64) NOT NULL,
  actor_username VARCHAR(64),
  target_type VARCHAR(64),
  target_id VARCHAR(64),
  outcome VARCHAR(32) NOT NULL,
  request_id VARCHAR(64),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_audit_logs_event_type ON audit_logs (event_type);
CREATE INDEX IF NOT EXISTS ix_audit_logs_request_id ON audit_logs (request_id);
