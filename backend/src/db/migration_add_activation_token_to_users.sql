ALTER TABLE users ADD COLUMN activation_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_activation_token_unique ON users(activation_token);
ALTER TABLE users ADD COLUMN activation_expires_at INTEGER;
