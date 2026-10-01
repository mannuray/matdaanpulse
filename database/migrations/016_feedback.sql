-- Migration 016: public feedback (POST /api/v1/feedback, admin /admin/feedback)
--
-- Viewers report bugs, data errors and suggestions; editors triage them in the
-- admin panel (status new → read → resolved). The raw client IP is never
-- stored: ip_hash is sha256(FEEDBACK_IP_SALT || ip), computed in the backend.
--
-- Idempotent; no seed dependency.

CREATE TABLE IF NOT EXISTS feedback (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind       TEXT NOT NULL,
    message    TEXT NOT NULL,
    email      TEXT,
    page       TEXT,
    status     TEXT NOT NULL DEFAULT 'new',
    ip_hash    TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_feedback_kind') THEN
    ALTER TABLE feedback ADD CONSTRAINT chk_feedback_kind
      CHECK (kind IN ('bug', 'data_error', 'suggestion', 'other'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_feedback_status') THEN
    ALTER TABLE feedback ADD CONSTRAINT chk_feedback_status
      CHECK (status IN ('new', 'read', 'resolved'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_feedback_message_length') THEN
    ALTER TABLE feedback ADD CONSTRAINT chk_feedback_message_length
      CHECK (char_length(message) <= 2000);
  END IF;
END $$;

-- Admin list: filter by status, newest first.
CREATE INDEX IF NOT EXISTS idx_feedback_status_created_at ON feedback (status, created_at DESC);
