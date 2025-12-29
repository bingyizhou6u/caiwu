-- Migration: Remove legacy authentication columns
-- Date: 2025-12-29
-- Description: Remove password/TOTP/activation fields from employees table
--              and drop trusted_devices table (replaced by CF Access)

-- SQLite doesn't support DROP COLUMN directly, but D1 does support it
-- https://developers.cloudflare.com/d1/reference/schema/#alter-table

-- First, drop indexes that depend on columns we're removing
DROP INDEX IF EXISTS idx_employees_activation_token;
DROP INDEX IF EXISTS idx_employees_reset_token;

-- Remove legacy auth columns from employees table
ALTER TABLE employees DROP COLUMN password_hash;
ALTER TABLE employees DROP COLUMN must_change_password;
ALTER TABLE employees DROP COLUMN password_changed;
ALTER TABLE employees DROP COLUMN totp_secret;
ALTER TABLE employees DROP COLUMN activation_token;
ALTER TABLE employees DROP COLUMN activation_expires_at;
ALTER TABLE employees DROP COLUMN reset_token;
ALTER TABLE employees DROP COLUMN reset_expires_at;

-- Drop trusted_devices table (no longer needed with CF Access)
DROP TABLE IF EXISTS trusted_devices;

-- Drop ip_whitelist_rule table (managed via Cloudflare Dashboard)
DROP TABLE IF EXISTS ip_whitelist_rule;
