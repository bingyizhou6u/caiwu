DROP TABLE IF EXISTS employee_salaries;
DROP TABLE IF EXISTS employee_allowances;

CREATE TABLE employee_salaries (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  salary_type TEXT NOT NULL, -- 'probation', 'regular'
  currency_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  effective_date TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE employee_allowances (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  allowance_type TEXT NOT NULL, -- 'living', 'housing', 'transportation', 'meal'
  currency_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  created_at INTEGER,
  updated_at INTEGER
);
