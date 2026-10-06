-- Party colours that replace a non-placeholder colour (fill-only seeds cannot). Each UPDATE applies only while the
-- party still has the old colour, so an admin's choice is never overwritten. Idempotent. User-approved 2026-10-06:
-- Shiv Sena, Shiv Sena (UBT) and the BJP were three oranges on one Maharashtra map; NCP (SP) was close to NCP's blue.
UPDATE parties SET color = '#B8430B' WHERE id = 'SHS' AND upper(color) = '#FF6600';
UPDATE parties SET color = '#F5B400' WHERE id = 'SHSUBT' AND upper(color) = '#FF8C00';
UPDATE parties SET color = '#0029B0' WHERE id = 'NCPSP' AND upper(color) = '#004C99';
