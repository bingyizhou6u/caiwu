
-- Fix missing auth columns in employees table (manually applied)
ALTER TABLE employees ADD COLUMN password_hash TEXT;
ALTER TABLE employees ADD COLUMN must_change_password INTEGER DEFAULT 0;
ALTER TABLE employees ADD COLUMN password_changed INTEGER DEFAULT 0;
ALTER TABLE employees ADD COLUMN totp_secret TEXT;
ALTER TABLE employees ADD COLUMN last_login_at INTEGER;
ALTER TABLE employees ADD COLUMN activation_token TEXT;
ALTER TABLE employees ADD COLUMN activation_expires_at INTEGER;
ALTER TABLE employees ADD COLUMN reset_token TEXT;
ALTER TABLE employees ADD COLUMN reset_expires_at INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_activation_token ON employees(activation_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_reset_token ON employees(reset_token);
