-- Controlled Shield-PDP fintech lab seed data.
-- Idempotent inserts only; no existing rows are deleted.
-- Password hashes are finalized by the FastAPI startup seed job.

INSERT INTO users (username, hashed_password, role, customer_id, is_admin, is_active)
VALUES
  ('alice', 'pending-app-startup', 'customer', 'CUST-ALICE', 0, 1),
  ('bob', 'pending-app-startup', 'customer', 'CUST-BOB', 0, 1),
  ('charlie', 'pending-app-startup', 'customer', 'CUST-CHARLIE', 0, 1),
  ('budi', 'pending-app-startup', 'customer', 'CUST-BUDI', 0, 1),
  ('maya', 'pending-app-startup', 'customer', 'CUST-MAYA', 0, 1),
  ('nadia', 'pending-app-startup', 'customer', 'CUST-NADIA', 0, 1),
  ('admin', 'pending-app-startup', 'admin', 'STAFF-ADMIN', 1, 1),
  ('auditor', 'pending-app-startup', 'auditor', 'STAFF-AUDITOR', 0, 1),
  ('pentester', 'pending-app-startup', 'pentester', 'STAFF-PENTESTER', 0, 1),
  ('merchant', 'pending-app-startup', 'customer', 'CUST-MERCHANT', 0, 1)
ON CONFLICT (username) DO UPDATE SET
  role = EXCLUDED.role,
  customer_id = EXCLUDED.customer_id,
  is_admin = EXCLUDED.is_admin,
  is_active = EXCLUDED.is_active;

INSERT INTO profiles (user_id, profile_id, customer_id, full_name, nik, biometric_sample, email, phone)
SELECT id, 'PROF-BUDI', 'CUST-BUDI', 'Budi Santoso', '3273010101010001', 'sha256:synthetic-budi', 'budi.santoso@example.test', '+62-812-1000-0001'
FROM users WHERE username = 'budi'
ON CONFLICT (user_id) DO UPDATE SET
  profile_id = EXCLUDED.profile_id,
  customer_id = EXCLUDED.customer_id,
  full_name = EXCLUDED.full_name,
  nik = EXCLUDED.nik,
  biometric_sample = EXCLUDED.biometric_sample,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone;

INSERT INTO profiles (user_id, profile_id, customer_id, full_name, nik, biometric_sample, email, phone)
SELECT id, 'PROF-MAYA', 'CUST-MAYA', 'Maya Kusuma', '3273020202020002', 'sha256:synthetic-maya', 'maya.kusuma@example.test', '+62-812-1000-0002'
FROM users WHERE username = 'maya'
ON CONFLICT (user_id) DO UPDATE SET
  profile_id = EXCLUDED.profile_id,
  customer_id = EXCLUDED.customer_id,
  full_name = EXCLUDED.full_name,
  nik = EXCLUDED.nik,
  biometric_sample = EXCLUDED.biometric_sample,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone;

INSERT INTO profiles (user_id, profile_id, customer_id, full_name, nik, biometric_sample, email, phone)
SELECT id, 'PROF-NADIA', 'CUST-NADIA', 'Nadia Prameswari', '3273030303030003', 'sha256:synthetic-nadia', 'nadia.prameswari@example.test', '+62-812-1000-0003'
FROM users WHERE username = 'nadia'
ON CONFLICT (user_id) DO UPDATE SET
  profile_id = EXCLUDED.profile_id,
  customer_id = EXCLUDED.customer_id,
  full_name = EXCLUDED.full_name,
  nik = EXCLUDED.nik,
  biometric_sample = EXCLUDED.biometric_sample,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone;

INSERT INTO profiles (user_id, profile_id, customer_id, full_name, nik, biometric_sample, email, phone)
SELECT id, 'PROF-ADMIN', 'STAFF-ADMIN', 'Admin Dana Sejahtera', '3171012345679999', 'sha256:admin-demo', 'admin.dana@example.test', '+62-812-9999-9999'
FROM users WHERE username = 'admin'
ON CONFLICT (user_id) DO UPDATE SET
  profile_id = EXCLUDED.profile_id,
  customer_id = EXCLUDED.customer_id,
  full_name = EXCLUDED.full_name,
  nik = EXCLUDED.nik,
  biometric_sample = EXCLUDED.biometric_sample,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone;

INSERT INTO profiles (user_id, profile_id, customer_id, full_name, nik, biometric_sample, email, phone)
SELECT id, 'PROF-AUDITOR', 'STAFF-AUDITOR', 'Auditor', '3171012345678888', 'sha256:auditor-demo', 'auditor@example.test', '+62-812-8888-8888'
FROM users WHERE username = 'auditor'
ON CONFLICT (user_id) DO UPDATE SET
  profile_id = EXCLUDED.profile_id,
  customer_id = EXCLUDED.customer_id,
  full_name = EXCLUDED.full_name,
  nik = EXCLUDED.nik,
  biometric_sample = EXCLUDED.biometric_sample,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone;

INSERT INTO profiles (user_id, profile_id, customer_id, full_name, nik, biometric_sample, email, phone)
SELECT id, 'PROF-PENTESTER', 'STAFF-PENTESTER', 'Pentester', '3171012345677777', 'sha256:pentester-demo', 'pentester@example.test', '+62-812-7777-7777'
FROM users WHERE username = 'pentester'
ON CONFLICT (user_id) DO UPDATE SET
  profile_id = EXCLUDED.profile_id,
  customer_id = EXCLUDED.customer_id,
  full_name = EXCLUDED.full_name,
  nik = EXCLUDED.nik,
  biometric_sample = EXCLUDED.biometric_sample,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone;

INSERT INTO profiles (user_id, profile_id, customer_id, full_name, nik, biometric_sample, email, phone)
SELECT id, 'PROF-MERCHANT', 'CUST-MERCHANT', 'Synthetic Merchant', '3273999999990001', 'sha256:merchant-demo', 'merchant@example.test', '+62-812-3333-3333'
FROM users WHERE username = 'merchant'
ON CONFLICT (user_id) DO UPDATE SET
  profile_id = EXCLUDED.profile_id,
  customer_id = EXCLUDED.customer_id,
  full_name = EXCLUDED.full_name,
  nik = EXCLUDED.nik,
  biometric_sample = EXCLUDED.biometric_sample,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone;

INSERT INTO accounts (owner_id, account_id, account_number, balance, currency, account_type, account_name, bank_name, status, classification, last_activity_at)
SELECT id, 'ACC-BUDI-001', '880012340001', 48275000.00, 'IDR', 'Primary Wallet', 'Budi Shield Wallet', 'Dana Sejahtera Wallet', 'active', 'Confidential', now()
FROM users WHERE username = 'budi'
ON CONFLICT (account_number) DO UPDATE SET
  owner_id = EXCLUDED.owner_id,
  account_id = EXCLUDED.account_id,
  currency = EXCLUDED.currency,
  account_type = EXCLUDED.account_type,
  account_name = EXCLUDED.account_name,
  bank_name = EXCLUDED.bank_name,
  status = EXCLUDED.status,
  classification = EXCLUDED.classification,
  last_activity_at = EXCLUDED.last_activity_at;

INSERT INTO accounts (owner_id, account_id, account_number, balance, currency, account_type, account_name, bank_name, status, classification, last_activity_at)
SELECT id, 'ACC-MAYA-001', '880012340002', 36750000.00, 'IDR', 'Primary Wallet', 'Maya Shield Wallet', 'Dana Sejahtera Wallet', 'active', 'Confidential', now()
FROM users WHERE username = 'maya'
ON CONFLICT (account_number) DO UPDATE SET
  owner_id = EXCLUDED.owner_id,
  account_id = EXCLUDED.account_id,
  currency = EXCLUDED.currency,
  account_type = EXCLUDED.account_type,
  account_name = EXCLUDED.account_name,
  bank_name = EXCLUDED.bank_name,
  status = EXCLUDED.status,
  classification = EXCLUDED.classification,
  last_activity_at = EXCLUDED.last_activity_at;

INSERT INTO accounts (owner_id, account_id, account_number, balance, currency, account_type, account_name, bank_name, status, classification, last_activity_at)
SELECT id, 'ACC-NADIA-001', '880012340003', 7500000.00, 'IDR', 'Primary Wallet', 'Nadia Shield Wallet', 'Dana Sejahtera Wallet', 'active', 'Confidential', now()
FROM users WHERE username = 'nadia'
ON CONFLICT (account_number) DO UPDATE SET
  owner_id = EXCLUDED.owner_id,
  account_id = EXCLUDED.account_id,
  currency = EXCLUDED.currency,
  account_type = EXCLUDED.account_type,
  account_name = EXCLUDED.account_name,
  bank_name = EXCLUDED.bank_name,
  status = EXCLUDED.status,
  classification = EXCLUDED.classification,
  last_activity_at = EXCLUDED.last_activity_at;

INSERT INTO accounts (owner_id, account_id, account_number, balance, currency, account_type, account_name, bank_name, status, classification, last_activity_at)
SELECT id, 'ACC-MERCHANT-001', '990012340001', 0.00, 'IDR', 'Escrow', 'Synthetic Merchant Settlement', 'Dana Sejahtera Settlement', 'active', 'Confidential', now()
FROM users WHERE username = 'merchant'
ON CONFLICT (account_number) DO UPDATE SET
  owner_id = EXCLUDED.owner_id,
  account_id = EXCLUDED.account_id,
  currency = EXCLUDED.currency,
  account_type = EXCLUDED.account_type,
  account_name = EXCLUDED.account_name,
  bank_name = EXCLUDED.bank_name,
  status = EXCLUDED.status,
  classification = EXCLUDED.classification,
  last_activity_at = EXCLUDED.last_activity_at;

INSERT INTO transactions (account_id, transaction_id, transaction_ref, amount, currency, direction, status, merchant, category, channel, risk, risk_score, suspicious_reason, created_at)
SELECT id, 'TRX-BUDI-001', 'TRX-BUDI-001', 78000.00, 'IDR', 'debit', 'settled', 'Kopi Ampera', 'Food and beverage', 'QRIS', 'low', 12, NULL, now() - interval '2 days'
FROM accounts WHERE account_id = 'ACC-BUDI-001'
ON CONFLICT (transaction_ref) DO UPDATE SET
  account_id = EXCLUDED.account_id,
  transaction_id = EXCLUDED.transaction_id,
  amount = EXCLUDED.amount,
  currency = EXCLUDED.currency,
  direction = EXCLUDED.direction,
  status = EXCLUDED.status,
  merchant = EXCLUDED.merchant,
  category = EXCLUDED.category,
  channel = EXCLUDED.channel,
  risk = EXCLUDED.risk,
  risk_score = EXCLUDED.risk_score,
  suspicious_reason = EXCLUDED.suspicious_reason,
  created_at = EXCLUDED.created_at;

INSERT INTO transactions (account_id, transaction_id, transaction_ref, amount, currency, direction, status, merchant, category, channel, risk, risk_score, suspicious_reason, created_at)
SELECT id, 'TRX-BUDI-002', 'TRX-BUDI-002', 18500000.00, 'IDR', 'credit', 'settled', 'Payroll PT Dana Sejahtera', 'Salary', 'Bank Transfer', 'low', 8, NULL, now() - interval '1 day'
FROM accounts WHERE account_id = 'ACC-BUDI-001'
ON CONFLICT (transaction_ref) DO UPDATE SET
  account_id = EXCLUDED.account_id,
  transaction_id = EXCLUDED.transaction_id,
  amount = EXCLUDED.amount,
  currency = EXCLUDED.currency,
  direction = EXCLUDED.direction,
  status = EXCLUDED.status,
  merchant = EXCLUDED.merchant,
  category = EXCLUDED.category,
  channel = EXCLUDED.channel,
  risk = EXCLUDED.risk,
  risk_score = EXCLUDED.risk_score,
  suspicious_reason = EXCLUDED.suspicious_reason,
  created_at = EXCLUDED.created_at;

INSERT INTO transactions (account_id, transaction_id, transaction_ref, amount, currency, direction, status, merchant, category, channel, risk, risk_score, suspicious_reason, created_at)
SELECT id, 'TRX-MAYA-001', 'TRX-MAYA-001', 425000.00, 'IDR', 'debit', 'settled', 'Sentra Kesehatan', 'Health', 'QRIS', 'medium', 42, 'Cross-owner detail reads should be investigated in the lab.', now() - interval '18 hours'
FROM accounts WHERE account_id = 'ACC-MAYA-001'
ON CONFLICT (transaction_ref) DO UPDATE SET
  account_id = EXCLUDED.account_id,
  transaction_id = EXCLUDED.transaction_id,
  amount = EXCLUDED.amount,
  currency = EXCLUDED.currency,
  direction = EXCLUDED.direction,
  status = EXCLUDED.status,
  merchant = EXCLUDED.merchant,
  category = EXCLUDED.category,
  channel = EXCLUDED.channel,
  risk = EXCLUDED.risk,
  risk_score = EXCLUDED.risk_score,
  suspicious_reason = EXCLUDED.suspicious_reason,
  created_at = EXCLUDED.created_at;

INSERT INTO transactions (account_id, transaction_id, transaction_ref, amount, currency, direction, status, merchant, category, channel, risk, risk_score, suspicious_reason, created_at)
SELECT id, 'TRX-MAYA-002', 'TRX-MAYA-002', 7250000.00, 'IDR', 'debit', 'review', 'Sarana Digital', 'Electronics', 'Virtual Account', 'high', 82, 'New beneficiary and high amount in synthetic demo data.', now() - interval '8 hours'
FROM accounts WHERE account_id = 'ACC-MAYA-001'
ON CONFLICT (transaction_ref) DO UPDATE SET
  account_id = EXCLUDED.account_id,
  transaction_id = EXCLUDED.transaction_id,
  amount = EXCLUDED.amount,
  currency = EXCLUDED.currency,
  direction = EXCLUDED.direction,
  status = EXCLUDED.status,
  merchant = EXCLUDED.merchant,
  category = EXCLUDED.category,
  channel = EXCLUDED.channel,
  risk = EXCLUDED.risk,
  risk_score = EXCLUDED.risk_score,
  suspicious_reason = EXCLUDED.suspicious_reason,
  created_at = EXCLUDED.created_at;

INSERT INTO segmentation_evidence (
  evidence_id,
  db_zone,
  app_zone,
  database_host,
  allowed_client,
  transport,
  postgres_listen_policy,
  public_listen,
  firewall_policy,
  segmentation_status,
  risk,
  pdp_impact
)
VALUES (
  'EVD-SEG-REMOTE-DB-001',
  'shield-db:on-prem-personal-data-zone',
  'shield-cloud:web-api-zone',
  '100.110.198.103',
  '100.119.241.7',
  'Tailscale',
  '127.0.0.1 and Tailscale IP only',
  0,
  '5432 allowed only from shield-cloud over tailscale0',
  'enforced',
  'low',
  'Positive evidence: database containing personal data is isolated from public network exposure.'
)
ON CONFLICT (evidence_id) DO UPDATE SET
  db_zone = EXCLUDED.db_zone,
  app_zone = EXCLUDED.app_zone,
  database_host = EXCLUDED.database_host,
  allowed_client = EXCLUDED.allowed_client,
  transport = EXCLUDED.transport,
  postgres_listen_policy = EXCLUDED.postgres_listen_policy,
  public_listen = EXCLUDED.public_listen,
  firewall_policy = EXCLUDED.firewall_policy,
  segmentation_status = EXCLUDED.segmentation_status,
  risk = EXCLUDED.risk,
  pdp_impact = EXCLUDED.pdp_impact;
