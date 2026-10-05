-- One md5 per table, over the VS elections of Bihar and the five Phase 2 states, over the columns the seeds own. Persons are excluded: an upgraded DB keeps admin and
-- multi-candidacy person names by design. Seat analysis is excluded: it is computed through the admin API after deploy.
WITH e AS (SELECT id FROM elections WHERE state_id IN (5, 4, 16, 27, 31, 36) AND type = 'VS')
-- District/region by code: their ids are serials, so a district added later (Assam's West Karbi Anglong) differs by DB.
SELECT 'constituencies', count(*), md5(string_agg(concat_ws('|', k.id, k.election_id, d.code, g.code, k.name, k.const_no, k.type, k.voter_turnout, k.phase, k.total_electors), E'\n' ORDER BY k.id))
  FROM constituencies k JOIN e ON e.id = k.election_id LEFT JOIN districts d ON d.id = k.district_id LEFT JOIN regions g ON g.id = k.region_id
UNION ALL
SELECT 'candidates', count(*), md5(string_agg(concat_ws('|', c.id, c.election_id, c.const_id, c.party_id, c.name, c.age), E'\n' ORDER BY c.id))
  FROM candidates c JOIN e ON e.id = c.election_id
UNION ALL
SELECT 'results', count(*), md5(string_agg(concat_ws('|', r.id, r.candidate_id, r.const_id, r.votes, r.status, r.margin, r.round_no), E'\n' ORDER BY r.id))
  FROM results r JOIN e ON e.id = r.election_id
UNION ALL
SELECT 'parties', count(*), md5(string_agg(p.id, ',' ORDER BY p.id))
  FROM parties p WHERE p.id IN (SELECT DISTINCT party_id FROM candidates c JOIN e ON e.id = c.election_id);
