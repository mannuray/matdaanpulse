-- 012: persist manifest drafts + keep audit history when a user is deleted.
-- Idempotent: safe to re-run, independent of seed data.

-- 1. Manifest drafts (previously held in backend memory and lost on restart).
ALTER TABLE elections ADD COLUMN IF NOT EXISTS manifest_draft JSONB NULL;

-- 2. audit_logs.user_id → users(id) ON DELETE SET NULL.
ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL;

DO $$
DECLARE
  fk RECORD;
  already_ok BOOLEAN := FALSE;
BEGIN
  -- Drop every FK on audit_logs(user_id) → users that is not already the target shape.
  FOR fk IN
    SELECT c.conname, c.confdeltype
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.conrelid = 'audit_logs'::regclass
      AND c.confrelid = 'users'::regclass
      AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute
                             WHERE attrelid = 'audit_logs'::regclass AND attname = 'user_id')]::smallint[]
  LOOP
    IF fk.conname = 'audit_logs_user_id_fkey' AND fk.confdeltype = 'n' AND NOT already_ok THEN
      already_ok := TRUE;
    ELSE
      EXECUTE format('ALTER TABLE audit_logs DROP CONSTRAINT %I', fk.conname);
    END IF;
  END LOOP;

  IF NOT already_ok THEN
    ALTER TABLE audit_logs
      ADD CONSTRAINT audit_logs_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;
