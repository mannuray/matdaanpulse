-- Per-constituency round tracking for live elections
ALTER TABLE constituencies ADD COLUMN IF NOT EXISTS current_round INT DEFAULT NULL;
ALTER TABLE constituencies ADD COLUMN IF NOT EXISTS total_rounds INT DEFAULT NULL;

-- DOWN (rollback):
-- ALTER TABLE constituencies DROP COLUMN current_round;
-- ALTER TABLE constituencies DROP COLUMN total_rounds;
