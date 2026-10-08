-- 027: revocable login tokens. Every session JWT carries the user's token_version (`tv` claim); JwtStrategy
-- rejects a token whose version differs from the row's. Bumped on logout and on a password change/reset, which
-- revokes every token issued before. Idempotent.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
