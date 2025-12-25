-- Reconstructed schema based on codebase analysis

-- Note: users table has been merged into employees table
-- All auth fields are now in employees table

-- Employees table (业务核心，包含员工所有信息)
DROP TABLE IF EXISTS employees;
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  personal_email TEXT,
  name TEXT DEFAULT '',
  position_id TEXT,
  org_department_id TEXT,
  department_id TEXT,
  join_date TEXT,
  probation_salary_cents INTEGER,
  regular_salary_cents INTEGER,
  living_allowance_cents INTEGER,
  housing_allowance_cents INTEGER,
  transportation_allowance_cents INTEGER,
  meal_allowance_cents INTEGER,
  status TEXT,
  active INTEGER DEFAULT 1,
  phone TEXT,
  usdt_address TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  address TEXT,
  memo TEXT,
  birthday TEXT,
  regular_date TEXT,
  work_schedule TEXT,
  annual_leave_cycle_months INTEGER,
  annual_leave_days INTEGER,
  created_at INTEGER,
  updated_at INTEGER,
  -- Auth fields (users merged into employees)
  password_hash TEXT,
  must_change_password INTEGER DEFAULT 0,
  password_changed INTEGER DEFAULT 0,
  totp_secret TEXT,
  last_login_at INTEGER,
  activation_token TEXT,
  activation_expires_at INTEGER,
  reset_token TEXT,
  reset_expires_at INTEGER
);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  level INTEGER NOT NULL, -- 1-总部 2-项目 3-组
  function_role TEXT NOT NULL, -- director/hr/finance/admin/developer
  can_manage_subordinates INTEGER DEFAULT 0,
  data_scope TEXT DEFAULT 'self' NOT NULL, -- all, project, group, self
  description TEXT,
  permissions TEXT, -- JSON string
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER
);

-- Departments (Projects) table
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  hq_id TEXT,
  sort_order INTEGER DEFAULT 100,
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
  allowed_modules TEXT, -- JSON数组，配置该部门可访问的功能模块
  allowed_positions TEXT, -- JSON数组，限制部门可用的职位ID
  default_position_id TEXT, -- 新员工默认职位ID
  active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER,
  last_active_at INTEGER
);

-- System Config table
DROP TABLE IF EXISTS system_config;
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at INTEGER,
  updated_by TEXT
);

-- Trusted Devices table
CREATE TABLE IF NOT EXISTS trusted_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  ip_address TEXT,
  user_agent TEXT,
  last_used_at INTEGER,
  created_at INTEGER
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
  symbol TEXT,
  active INTEGER DEFAULT 1
);

-- User Departments (Many-to-Many)
CREATE TABLE IF NOT EXISTS user_departments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  department_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Opening Balances table
CREATE TABLE IF NOT EXISTS opening_balances (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'account', etc.
  ref_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER
);

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  currency TEXT NOT NULL,
  alias TEXT,
  account_number TEXT,
  opening_cents INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  version INTEGER DEFAULT 1
);

-- Cash Flows table
CREATE TABLE IF NOT EXISTS cash_flows (
  id TEXT PRIMARY KEY,
  voucher_no TEXT,
  biz_date TEXT NOT NULL,
  type TEXT NOT NULL, -- 'income', 'expense'
  account_id TEXT NOT NULL,
  category_id TEXT,
  method TEXT,
  amount_cents INTEGER NOT NULL,
  site_id TEXT,
  department_id TEXT,
  counterparty TEXT,
  memo TEXT,
  voucher_url TEXT,
  created_by TEXT,
  created_at INTEGER,
  is_reversal INTEGER DEFAULT 0,
  reversal_of_flow_id TEXT,
  is_reversed INTEGER DEFAULT 0,
  reversed_by_flow_id TEXT
);

-- Account Transactions table
CREATE TABLE IF NOT EXISTS account_transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  flow_id TEXT NOT NULL,
  transaction_date TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  balance_before_cents INTEGER NOT NULL,
  balance_after_cents INTEGER NOT NULL,
  created_at INTEGER
);

-- Employee Salaries table
CREATE TABLE IF NOT EXISTS employee_salaries (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  salary_type TEXT NOT NULL, -- 'probation', 'regular'
  currency_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  effective_date TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS employee_allowances (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  allowance_type TEXT NOT NULL, -- 'living', 'housing', 'transportation', 'meal'
  currency_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS allowance_payments (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  allowance_type TEXT NOT NULL,
  currency_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  payment_date TEXT NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  voucher_url TEXT,
  memo TEXT,
  created_by TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

-- Employee Leaves table
CREATE TABLE IF NOT EXISTS employee_leaves (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  leave_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  reason TEXT,
  memo TEXT,
  approved_by TEXT,
  approved_at INTEGER,
  version INTEGER DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER
);

-- Salary Payments table
CREATE TABLE IF NOT EXISTS salary_payments (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  salary_cents INTEGER NOT NULL,
  status TEXT NOT NULL, -- pending_employee_confirmation, pending_finance_approval, pending_payment, pending_payment_confirmation, completed
  allocation_status TEXT DEFAULT 'pending', -- pending, requested, approved
  employee_confirmed_by TEXT,
  employee_confirmed_at INTEGER,
  finance_approved_by TEXT,
  finance_approved_at INTEGER,
  account_id TEXT,
  payment_transferred_by TEXT,
  payment_transferred_at INTEGER,
  payment_voucher_path TEXT,
  payment_confirmed_by TEXT,
  payment_confirmed_at INTEGER,
  rollback_reason TEXT,
  rollback_by TEXT,
  rollback_at INTEGER,
  version INTEGER DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER
);

-- Salary Payment Allocations table
CREATE TABLE IF NOT EXISTS salary_payment_allocations (
  id TEXT PRIMARY KEY,
  salary_payment_id TEXT NOT NULL,
  currency_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  account_id TEXT,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  requested_by TEXT,
  requested_at INTEGER,
  approved_by TEXT,
  approved_at INTEGER,
  created_at INTEGER,
  updated_at INTEGER
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
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

-- Sites table
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  department_id TEXT NOT NULL,
  name TEXT NOT NULL,
  site_code TEXT,
  active INTEGER DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL, -- income, expense
  parent_id TEXT,
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);

-- AR/AP Docs table
CREATE TABLE IF NOT EXISTS ar_ap_docs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL, -- AR, AP
  party_id TEXT,
  site_id TEXT,
  department_id TEXT,
  issue_date TEXT,
  due_date TEXT,
  amount_cents INTEGER NOT NULL,
  doc_no TEXT,
  memo TEXT,
  status TEXT DEFAULT 'open', -- open, partial, settled
  created_at INTEGER,
  updated_at INTEGER
);

-- Borrowings table
CREATE TABLE IF NOT EXISTS borrowings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  borrower_id TEXT,
  account_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  borrow_date TEXT NOT NULL,
  memo TEXT,
  status TEXT DEFAULT 'outstanding', -- outstanding, partial, repaid, pending, approved, rejected
  approved_by TEXT,
  approved_at INTEGER,
  version INTEGER DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER
);

-- Repayments table
CREATE TABLE IF NOT EXISTS repayments (
  id TEXT PRIMARY KEY,
  borrowing_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  repay_date TEXT NOT NULL,
  memo TEXT,
  created_by TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

-- Settlements table
CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL,
  flow_id TEXT NOT NULL,
  settle_amount_cents INTEGER NOT NULL,
  settle_date TEXT,
  created_at INTEGER
);

-- Vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  memo TEXT,
  active INTEGER DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER
);

-- Account Transfers table
CREATE TABLE IF NOT EXISTS account_transfers (
  id TEXT PRIMARY KEY,
  transfer_date TEXT NOT NULL,
  from_account_id TEXT NOT NULL,
  to_account_id TEXT NOT NULL,
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  from_amount_cents INTEGER NOT NULL,
  to_amount_cents INTEGER NOT NULL,
  exchange_rate REAL,
  memo TEXT,
  voucher_url TEXT,
  created_by TEXT,
  created_at INTEGER
);

-- Site Bills table
CREATE TABLE IF NOT EXISTS site_bills (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  bill_date TEXT NOT NULL,
  bill_type TEXT NOT NULL, -- 'water', 'electricity', 'internet', 'other'
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  description TEXT,
  account_id TEXT,
  category_id TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'paid'
  payment_date TEXT,
  memo TEXT,
  created_by TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

-- IP Whitelist Rule table
CREATE TABLE IF NOT EXISTS ip_whitelist_rule (
  id TEXT PRIMARY KEY,
  cloudflare_rule_id TEXT NOT NULL,
  cloudflare_ruleset_id TEXT NOT NULL,
  enabled INTEGER DEFAULT 0,
  description TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

-- Fixed Assets table
CREATE TABLE IF NOT EXISTS fixed_assets (
  id TEXT PRIMARY KEY,
  asset_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  purchase_date TEXT,
  purchase_price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  vendor_id TEXT,
  department_id TEXT,
  site_id TEXT,
  custodian TEXT,
  status TEXT DEFAULT 'in_use',
  depreciation_method TEXT,
  useful_life_years INTEGER,
  current_value_cents INTEGER,
  memo TEXT,
  sale_date TEXT,
  sale_price_cents INTEGER,
  sale_buyer TEXT,
  sale_memo TEXT,
  created_by TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

-- Fixed Asset Depreciations table
CREATE TABLE IF NOT EXISTS fixed_asset_depreciations (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  depreciation_date TEXT NOT NULL,
  depreciation_amount_cents INTEGER NOT NULL,
  accumulated_depreciation_cents INTEGER NOT NULL,
  remaining_value_cents INTEGER NOT NULL,
  memo TEXT,
  created_by TEXT,
  created_at INTEGER
);

-- Fixed Asset Changes table
CREATE TABLE IF NOT EXISTS fixed_asset_changes (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  change_type TEXT NOT NULL,
  change_date TEXT NOT NULL,
  from_dept_id TEXT,
  to_dept_id TEXT,
  from_site_id TEXT,
  to_site_id TEXT,
  from_custodian TEXT,
  to_custodian TEXT,
  from_status TEXT,
  to_status TEXT,
  memo TEXT,
  created_by TEXT,
  created_at INTEGER
);

-- Fixed Asset Allocations table
CREATE TABLE IF NOT EXISTS fixed_asset_allocations (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  allocation_date TEXT NOT NULL,
  allocation_type TEXT DEFAULT 'employee_onboarding',
  return_date TEXT,
  return_type TEXT,
  memo TEXT,
  created_by TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

-- Rental Properties table
CREATE TABLE IF NOT EXISTS rental_properties (
  id TEXT PRIMARY KEY,
  property_code TEXT NOT NULL,
  name TEXT NOT NULL,
  property_type TEXT NOT NULL, -- office, dormitory, apartment, warehouse
  address TEXT,
  area_sqm REAL,
  rent_type TEXT DEFAULT 'monthly', -- monthly, yearly
  monthly_rent_cents INTEGER,
  yearly_rent_cents INTEGER,
  currency TEXT NOT NULL,
  payment_period_months INTEGER DEFAULT 1,
  landlord_name TEXT,
  landlord_contact TEXT,
  lease_start_date TEXT,
  lease_end_date TEXT,
  deposit_cents INTEGER,
  payment_method TEXT,
  payment_account_id TEXT,
  payment_day INTEGER DEFAULT 1,
  department_id TEXT,
  status TEXT DEFAULT 'active', -- active, inactive
  memo TEXT,
  contract_file_url TEXT,
  created_by TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

-- Rental Payments table
CREATE TABLE IF NOT EXISTS rental_payments (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  payment_date TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  account_id TEXT NOT NULL,
  category_id TEXT,
  payment_method TEXT,
  voucher_url TEXT,
  memo TEXT,
  created_by TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

-- Rental Changes table
CREATE TABLE IF NOT EXISTS rental_changes (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  change_type TEXT NOT NULL, -- modify, renew, terminate
  change_date TEXT NOT NULL,
  from_lease_start TEXT,
  to_lease_start TEXT,
  from_lease_end TEXT,
  to_lease_end TEXT,
  from_monthly_rent_cents INTEGER,
  to_monthly_rent_cents INTEGER,
  from_status TEXT,
  to_status TEXT,
  memo TEXT,
  created_by TEXT,
  created_at INTEGER
);

-- Dormitory Allocations table
CREATE TABLE IF NOT EXISTS dormitory_allocations (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  room_number TEXT,
  bed_number TEXT,
  allocation_date TEXT NOT NULL,
  monthly_rent_cents INTEGER,
  return_date TEXT,
  memo TEXT,
  created_by TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

-- Rental Payable Bills table
CREATE TABLE IF NOT EXISTS rental_payable_bills (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  bill_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  payment_period_months INTEGER DEFAULT 1,
  status TEXT DEFAULT 'unpaid', -- unpaid, paid
  paid_date TEXT,
  paid_payment_id TEXT,
  memo TEXT,
  created_by TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

-- Expense Reimbursements table
CREATE TABLE IF NOT EXISTS expense_reimbursements (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  expense_type TEXT NOT NULL, -- travel, office, meal, transport, other
  amount_cents INTEGER NOT NULL,
  currency_id TEXT DEFAULT 'CNY',
  expense_date TEXT NOT NULL,
  description TEXT NOT NULL,
  voucher_url TEXT,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  approved_by TEXT,
  approved_at INTEGER,
  memo TEXT,
  created_by TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

-- Site Config table
CREATE TABLE IF NOT EXISTS site_config (
  id TEXT PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT,
  description TEXT,
  is_encrypted INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);

-- Business Operation History table
CREATE TABLE IF NOT EXISTS business_operation_history (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  operator_id TEXT,
  operator_name TEXT,
  before_data TEXT,
  after_data TEXT,
  memo TEXT,
  created_at INTEGER NOT NULL
);
