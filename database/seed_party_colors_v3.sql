-- Party colours that replace a non-placeholder colour (fill-only seeds cannot). Each UPDATE applies only while the
-- party still has the old colour, so an admin's choice is never overwritten. Idempotent.
-- SKM: the old orange-red (#FF4500) read almost as the BJP's orange (#FF7A1A) on Sikkim's map; Wikipedia's SKM red
-- (Module:Political party; user-approved 2026-10-06).
UPDATE parties SET color = '#ED1E26' WHERE id = 'SKM' AND upper(color) = '#FF4500';
