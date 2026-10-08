BEGIN;

-- Run once (seed_runs). The 2011-2021 manifests of Tamil Nadu, Kerala, Assam and Puducherry name their key leaders'
-- seats by the seat ids of the data replaced on 2026-10-03, so those leader cards found no seat ("Pending" in a
-- finished election). Points each one at the seat the leader actually contested (checked against the candidates)
-- and adds that candidacy's person when the entry has none. V. Narayanasamy did not contest in 2016 (he entered
-- through a by-election), so his entry loses its seat. An entry moves only while it still has the old id, so admin
-- edits stand. Published manifests and drafts alike.
SELECT NOT EXISTS (SELECT 1 FROM seed_runs WHERE name = 'seed_manifest_leader_seats_v1')
   AS seed_apply \gset
\if :seed_apply

CREATE TEMP TABLE leader_seat_fix (election_id uuid, old_const text, new_const text, party_id text) ON COMMIT DROP;
INSERT INTO leader_seat_fix (election_id, old_const, new_const, party_id) VALUES
  ('e5f6a7b8-c9d0-1234-ef01-456789012011', 'TN_VS11_138_THIRUVARUR', 'TN_VS11_168_THIRUVARUR', 'DMK'),
  ('e5f6a7b8-c9d0-1234-ef01-456789012011', 'TN_VS11_159_SRIRANGAM', 'TN_VS11_139_SRIRANGAM', 'AIADMK'),
  ('e5f6a7b8-c9d0-1234-ef01-456789012016', 'TN_VS16_138_THIRUVARUR', 'TN_VS16_168_THIRUVARUR', 'DMK'),
  ('e5f6a7b8-c9d0-1234-ef01-456789012021', 'TN_VS21_82_KOLATHUR', 'TN_VS21_13_KOLATHUR', 'DMK'),
  ('e5f6a7b8-c9d0-1234-ef01-456789012021', 'TN_VS21_94_EDAPPADI', 'TN_VS21_86_EDAPPADI', 'AIADMK'),
  ('a7b8c9d0-e1f2-3456-0123-678901232011', 'KL_VS11_112_PUTHUPPALLY', 'KL_VS11_98_PUTHUPPALLY', 'INC'),
  ('a7b8c9d0-e1f2-3456-0123-678901232011', 'KL_VS11_52_MALAMPUZHA', 'KL_VS11_55_MALAMPUZHA', 'CPIM'),
  ('a7b8c9d0-e1f2-3456-0123-678901232016', 'KL_VS16_112_PUTHUPPALLY', 'KL_VS16_98_PUTHUPPALLY', 'INC'),
  ('a7b8c9d0-e1f2-3456-0123-678901232016', 'KL_VS16_4_DHARMADOM', 'KL_VS16_12_DHARMADAM', 'CPIM'),
  ('a7b8c9d0-e1f2-3456-0123-678901232021', 'KL_VS21_109_HARIPAD', 'KL_VS21_107_HARIPAD', 'INC'),
  ('a7b8c9d0-e1f2-3456-0123-678901232021', 'KL_VS21_4_DHARMADOM', 'KL_VS21_12_DHARMADAM', 'CPIM'),
  ('f6a7b8c9-d0e1-2345-f012-567890122011', 'AS_VS11_83_TITABAR', 'AS_VS11_100_TITABAR', 'INC'),
  ('f6a7b8c9-d0e1-2345-f012-567890122016', 'AS_VS16_83_TITABAR', 'AS_VS16_100_TITABAR', 'INC'),
  ('f6a7b8c9-d0e1-2345-f012-567890122016', 'AS_VS16_109_MAJULI', 'AS_VS16_99_MAJULI', 'BJP'),
  ('f6a7b8c9-d0e1-2345-f012-567890122021', 'AS_VS21_40_JALUKBARI', 'AS_VS21_51_JALUKBARI', 'BJP'),
  ('b1c2d3e4-f5a6-7890-1234-567890ab2016', 'PY_VS16_14_NELLITHOPE', '', 'INC'),
  ('b1c2d3e4-f5a6-7890-1234-567890ab2016', 'PY_VS16_19_YANAM', 'PY_VS16_8_INDIRA_NAGAR', 'AINRC'),
  ('b1c2d3e4-f5a6-7890-1234-567890ab2021', 'PY_VS21_19_YANAM', 'PY_VS21_9_THATTANCHAVADY', 'AINRC');

-- The fixed leaders array of one manifest document (entries without a fix are kept as they are, in order).
CREATE FUNCTION pg_temp.fix_leader_seats(eid uuid, doc jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_set(doc, '{leaders}', (
    SELECT jsonb_agg(CASE WHEN f.old_const IS NULL THEN l ELSE
      l || jsonb_build_object('const_id', f.new_const)
        || CASE WHEN f.new_const = '' OR COALESCE(l->>'person_id', '') <> '' THEN '{}'::jsonb ELSE COALESCE((
             SELECT jsonb_build_object('person_id', ca.person_id::text) FROM candidates ca
             WHERE ca.election_id = eid AND ca.const_id = f.new_const AND ca.party_id = f.party_id AND ca.person_id IS NOT NULL
             ORDER BY ca.id LIMIT 1), '{}'::jsonb) END
      END ORDER BY ord)
    FROM jsonb_array_elements(doc->'leaders') WITH ORDINALITY x(l, ord)
    LEFT JOIN leader_seat_fix f ON f.election_id = eid AND f.old_const = l->>'const_id'))
$$;

UPDATE elections e SET manifest_url = pg_temp.fix_leader_seats(e.id, e.manifest_url::jsonb)::text
WHERE e.manifest_url LIKE '{%' AND jsonb_typeof(e.manifest_url::jsonb->'leaders') = 'array'
  AND EXISTS (SELECT 1 FROM leader_seat_fix f, jsonb_array_elements(e.manifest_url::jsonb->'leaders') l
              WHERE f.election_id = e.id AND l->>'const_id' = f.old_const);

UPDATE elections e SET manifest_draft = pg_temp.fix_leader_seats(e.id, e.manifest_draft)
WHERE jsonb_typeof(e.manifest_draft) = 'object' AND jsonb_typeof(e.manifest_draft->'leaders') = 'array'
  AND EXISTS (SELECT 1 FROM leader_seat_fix f, jsonb_array_elements(e.manifest_draft->'leaders') l
              WHERE f.election_id = e.id AND l->>'const_id' = f.old_const);

INSERT INTO seed_runs (name) VALUES ('seed_manifest_leader_seats_v1') ON CONFLICT (name) DO NOTHING;

\endif

COMMIT;
