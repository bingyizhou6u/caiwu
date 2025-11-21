-- Reconstructed schema based on codebase analysis

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT,
  active INTEGER DEFAULT 1,
  must_change_password INTEGER DEFAULT 0,
  password_changed INTEGER DEFAULT 0,
  totp_secret TEXT,
  last_login_at INTEGER,
  created_at INTEGER,
  updated_at INTEGER
);

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  position_id TEXT,
  org_department_id TEXT,
  department_id TEXT,
  active INTEGER DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER
);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  level TEXT,
  scope TEXT,
  permissions TEXT, -- JSON string
  active INTEGER DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER
);

-- Departments (Projects) table
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  active INTEGER DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER
);

-- Org Departments table
CREATE TABLE IF NOT EXISTS org_departments (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  parent_id TEXT,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

-- System Config table
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at INTEGER
);

-- Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  detail TEXT, -- JSON string
  ip TEXT,
  ip_location TEXT,
  at INTEGER
);

-- Headquarters table
CREATE TABLE IF NOT EXISTS headquarters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active INTEGER DEFAULT 1
);

-- Currencies table
CREATE TABLE IF NOT EXISTS currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active INTEGER DEFAULT 1
);

-- User Departments (Many-to-Many)
CREATE TABLE IF NOT EXISTS user_departments (
  user_id TEXT NOT NULL,
  department_id TEXT NOT NULL,
  PRIMARY KEY (user_id, department_id)
);

-- Opening Balances table
CREATE TABLE IF NOT EXISTS opening_balances (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'account', etc.
  ref_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER
);

-- Cash Flows table
CREATE TABLE IF NOT EXISTS cash_flows (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'income', 'expense'
  amount_cents INTEGER NOT NULL DEFAULT 0,
  biz_date TEXT NOT NULL,
  created_at INTEGER
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_org_department_id ON employees(org_department_id);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(active);
CREATE INDEX IF NOT EXISTS idx_org_departments_parent_id ON org_departments(parent_id);
CREATE INDEX IF NOT EXISTS idx_org_departments_project_id ON org_departments(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_department_id ON user_departments(department_id);
CREATE INDEX IF NOT EXISTS idx_cash_flows_account_id ON cash_flows(account_id);
CREATE INDEX IF NOT EXISTS idx_cash_flows_biz_date ON cash_flows(biz_date);
CREATE INDEX IF NOT EXISTS idx_cash_flows_type ON cash_flows(type);
