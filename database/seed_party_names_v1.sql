-- Party display names that ECI's party lists misspell (the parties seeds insert them as listed). Each UPDATE applies
-- only while the misspelt name is set, so an admin's edit is never overwritten. Idempotent.
UPDATE parties SET name = 'Shiv Sena (Uddhav Balasaheb Thackeray)' WHERE id = 'SHSUBT' AND name = 'Shiv Sena (Uddhav Balasaheb Thackrey)';
UPDATE parties SET name = 'Maharashtra Navnirman Sena' WHERE id = 'MNS' AND name = 'Maharashtra Navnirman sena';
