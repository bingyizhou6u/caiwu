-- Migration: Merge users table into employees table
-- This script adds authentication fields to employees table and migrates data from users

-- Step 1: Add authentication columns to employees table
ALTER TABLE employees ADD COLUMN password_hash TEXT;
ALTER TABLE employees ADD COLUMN must_change_password INTEGER DEFAULT 0;
ALTER TABLE employees ADD COLUMN password_changed INTEGER DEFAULT 0;
ALTER TABLE employees ADD COLUMN totp_secret TEXT;
ALTER TABLE employees ADD COLUMN last_login_at INTEGER;
ALTER TABLE employees ADD COLUMN activation_token TEXT;
ALTER TABLE employees ADD COLUMN activation_expires_at INTEGER;
ALTER TABLE employees ADD COLUMN reset_token TEXT;
ALTER TABLE employees ADD COLUMN reset_expires_at INTEGER;

-- Step 2: Migrate authentication data from users to employees
-- Match by email (employees.email = users.email) OR personal_email
UPDATE employees SET
    password_hash = (SELECT password_hash FROM users WHERE users.email = employees.email OR users.email = employees.personal_email),
    must_change_password = (SELECT must_change_password FROM users WHERE users.email = employees.email OR users.email = employees.personal_email),
    password_changed = (SELECT password_changed FROM users WHERE users.email = employees.email OR users.email = employees.personal_email),
    totp_secret = (SELECT totp_secret FROM users WHERE users.email = employees.email OR users.email = employees.personal_email),
    last_login_at = (SELECT last_login_at FROM users WHERE users.email = employees.email OR users.email = employees.personal_email),
    activation_token = (SELECT activation_token FROM users WHERE users.email = employees.email OR users.email = employees.personal_email),
    activation_expires_at = (SELECT activation_expires_at FROM users WHERE users.email = employees.email OR users.email = employees.personal_email),
    reset_token = (SELECT reset_token FROM users WHERE users.email = employees.email OR users.email = employees.personal_email),
    reset_expires_at = (SELECT reset_expires_at FROM users WHERE users.email = employees.email OR users.email = employees.personal_email);

-- Step 3: Update sessions table to reference employees
-- First, update user_id to point to employee_id
UPDATE sessions SET user_id = (
    SELECT e.id FROM employees e 
    JOIN users u ON (u.email = e.email OR u.email = e.personal_email)
    WHERE u.id = sessions.user_id
);

-- Step 4: Update user_departments table to reference employees
UPDATE user_departments SET user_id = (
    SELECT e.id FROM employees e 
    JOIN users u ON (u.email = e.email OR u.email = e.personal_email)
    WHERE u.id = user_departments.user_id
);

-- Step 5: Update trusted_devices table to reference employees
UPDATE trusted_devices SET user_id = (
    SELECT e.id FROM employees e 
    JOIN users u ON (u.email = e.email OR u.email = e.personal_email)
    WHERE u.id = trusted_devices.user_id
);

-- Step 6: Drop the users table (only after confirming migration is successful)
-- DROP TABLE users;

-- Step 7: Create unique indexes on new auth fields
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_activation_token ON employees(activation_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_reset_token ON employees(reset_token);
