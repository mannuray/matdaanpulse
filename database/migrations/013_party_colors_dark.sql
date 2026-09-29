-- Party colours that were indistinguishable on the dark studio dashboard
-- (JD(U) vs RJD vs AIMIM greens, HAM(S)/RLM greys vs Others, CPI(ML)/CPI(M) reds).
-- Idempotent: plain UPDATEs keyed by party id.
UPDATE parties SET color = '#1FA37A' WHERE id = 'JDU';
UPDATE parties SET color = '#7BD34A' WHERE id = 'RJD';
UPDATE parties SET color = '#2BB673' WHERE id = 'AIMIM';
UPDATE parties SET color = '#E8C547' WHERE id = 'HAMS';
UPDATE parties SET color = '#D06CB0' WHERE id = 'RLM';
UPDATE parties SET color = '#3B8BFF' WHERE id = 'LJPRV';
UPDATE parties SET color = '#38C6F4' WHERE id = 'INC';
UPDATE parties SET color = '#FF7A1A' WHERE id = 'BJP';
UPDATE parties SET color = '#E5484D' WHERE id = 'CPIML';
UPDATE parties SET color = '#B83A3E' WHERE id = 'CPIM';
UPDATE parties SET color = '#4B5BD6' WHERE id = 'BSP';
