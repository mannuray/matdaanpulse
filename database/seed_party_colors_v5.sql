-- Party colours that replace a non-placeholder colour (fill-only seeds cannot). Each UPDATE applies only while the
-- party still has the old colour, so an admin's choice is never overwritten. Idempotent. User-approved 2026-10-07:
-- PDP's light green was hard to read on a light background (Wikipedia's #058532); People's Conference had grey.
UPDATE parties SET color = '#058532' WHERE id = 'JKPDP' AND upper(color) = '#90EE90';
UPDATE parties SET color = '#005085' WHERE id = 'JKPC' AND upper(color) = '#808080';
