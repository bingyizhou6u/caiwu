-- Add reset password token fields to users table
ALTER TABLE users ADD COLUMN reset_token TEXT UNIQUE;
ALTER TABLE users ADD COLUMN reset_expires_at INTEGER;
