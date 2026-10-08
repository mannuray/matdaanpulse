BEGIN;

-- Run once (seed_runs). Second pass over the person-link review queue of Goa, Manipur, Punjab, Uttarakhand and
-- Uttar Pradesh (after seed_links_review_2027_states_v1): the remaining groups with a winner, checked by hand on
-- 2026-10-08. A group links when the seat is the same, the declared ages fit and the party is the same or a known
-- switch; groups mixing in a namesake link only the matching members. Common names whose ages or parties disagree
-- stay unlinked. Each candidacy moves by candidate id to its group's keeper person (one with a profile, else the most
-- candidacies); the keeper's empty profile fields are filled, and party roles and manifest person ids that pointed
-- at an absorbed person move to the keeper before the orphan trigger deletes it. Recompute the seat analysis after.
SELECT NOT EXISTS (SELECT 1 FROM seed_runs WHERE name = 'seed_links_review_2027_states_v2')
   AS seed_apply \gset
\if :seed_apply

CREATE TEMP TABLE link_review (g int, cand uuid) ON COMMIT DROP;
INSERT INTO link_review (g, cand) VALUES
  (1, '82d28f33-0121-530d-b534-8a99b323728a'),
  (1, 'ee72f862-f5e3-52ca-b5e5-74d72a2625d9'),
  (2, '4b0ddbd3-3076-57d3-bce5-40440f0d51c9'),
  (2, 'f94127b2-f44e-526e-acc8-9e190dd960e4'),
  (3, '4b617a36-5bc2-5135-9bc9-6ee77fd5794e'),
  (3, '7efa6341-1503-56eb-8c49-1c9c16bf51f8'),
  (4, '7724378d-1a5f-5fed-8906-c415512244b2'),
  (4, '50916540-2a8a-5ad5-8f88-85d5359a1dfd'),
  (5, 'ba2eea59-b4cd-5905-a575-958136960ffe'),
  (5, '47b041e2-2bb1-54e4-8276-ed94d5917ab4'),
  (6, '15ea41d3-73c5-5539-adb1-f224c4646c9a'),
  (6, 'c51592ed-3a89-574c-b164-5418b7c8012d'),
  (7, '46cb83c7-51e1-5769-8f23-fc728abf2ee8'),
  (7, '28f1336c-3a8a-53db-9523-5b746b7c35d3'),
  (7, '9b0ed523-d938-5766-a93c-527ca2cc5254'),
  (8, 'c4e16faf-e5e9-5148-bc95-9a8a2a44a4cd'),
  (8, '2591e1d3-f7eb-54b9-89d4-f3301bb9a642'),
  (8, '0d8751eb-5c02-53fa-b51f-badb589d113c'),
  (9, 'e6ecd53c-35eb-5895-862e-80734725b91f'),
  (9, 'f56a1109-9163-565d-ad32-013dfeac7aa6'),
  (10, '65af357e-6521-5c5c-b1da-23f74ba3a26f'),
  (10, '8dea9506-c167-557b-bf18-b6233dbf1ff5'),
  (11, 'c02a2096-8e00-5d57-a03f-d8a12c938117'),
  (11, 'b2d919c1-8115-5e43-a4e8-8c9cbee21d35'),
  (11, '0bcdb619-1ec9-5434-9b4d-3365556e91b6'),
  (12, 'b2b09ed8-b579-5f28-a10b-a515e1426128'),
  (12, 'd556cd7a-3166-5c9e-ba95-5385fab25f0e'),
  (13, 'a6d0e2da-bbad-5a69-9226-80f1a25757ee'),
  (13, '573e7337-2851-5c6b-b128-229359b6bb82'),
  (14, 'c458bbd1-7406-558f-be51-f6d1cff39f15'),
  (14, 'd7df2bf2-1a5d-59a4-b520-0fd233de58e1'),
  (15, 'f289a5ac-f54a-5388-9fc5-debedc14bfe2'),
  (15, 'd2d215fd-3699-5b6a-84a3-35c89901995b'),
  (16, 'e93a0109-6be0-5b27-ac97-7074faecdbed'),
  (16, '2233f5a9-a58f-5642-a729-4b92e3fa6a6a'),
  (17, '295731a2-ad77-5aec-bace-ea2f6542b784'),
  (17, 'e023818d-a44c-535c-acf5-eeac12af5fe2'),
  (18, 'f62b7d99-a549-5e16-9d97-7de50b2e013f'),
  (18, 'f8c42ed9-8f48-51d5-a0bf-fad163d0e444'),
  (19, '7137d35e-1ea3-5255-85da-02c0a53be681'),
  (19, 'd9f1874b-03e2-5c25-804b-aafd7f0eff2e'),
  (19, 'e54e1946-f211-5eeb-8733-26ca06127037'),
  (20, '2e203702-95bf-553d-b6e8-0f92b2ed7c30'),
  (20, '3b65917a-92fd-52b8-bac5-c7d5f49a7ecb'),
  (21, '8eddcbb0-f094-594a-a3ab-7bc3060c84a4'),
  (21, '5504790d-f0e8-57b4-8219-29ee7552a9d4'),
  (22, 'b6575099-3589-55c9-aaf5-012e8b6a28e6'),
  (22, 'ef3eb77b-cd67-541f-843b-3d4f863963c6'),
  (23, '60613f4f-5e11-5510-9de7-905ce11a62b1'),
  (23, 'ef1cb6da-7a31-5032-b13c-d5324798904b'),
  (24, 'd3f1b892-ed41-5403-8d9f-94dcea9814fe'),
  (24, '1ed0c242-25cb-53a6-9b5b-8e706c43adaf'),
  (25, 'c72b05c8-4deb-5ffc-9494-c45014118e29'),
  (25, '53ea8fe4-4bbf-558c-b605-c7b7ead5c8e6'),
  (26, 'f90cf0e5-feed-5f6f-91ca-3dfbca3a7f7a'),
  (26, '37be53ad-2cb5-531d-8113-a924adea9ae5'),
  (27, '1826d479-22eb-5dda-b03b-d603270b10a9'),
  (27, '634e1162-70e0-5e69-b7dc-0c7f0a2bbb11'),
  (28, '9edfa5a8-b77b-5250-9635-a385b35a57ee'),
  (28, 'c00decb6-9ac4-5d52-9d67-e8cfa5c70de8'),
  (29, '6aef3a18-6bb8-5ec9-9ff9-96a9867d0c1d'),
  (29, '1e5ddc06-acd5-52a8-8490-e75f357c1875'),
  (30, 'b61055b9-38f7-50d9-aa8a-1c390442b546'),
  (30, '5231d4dd-3fe4-5db6-8ae0-dd6f82a6c9bd'),
  (31, 'e04824e8-54fd-5b1c-ac20-80fc95387b72'),
  (31, '0177b303-8bb4-5908-9bd5-e26a6e12e970'),
  (32, 'c1cb3be8-6b13-5054-8a39-b4c7249a3517'),
  (32, '861de654-1106-53ac-871a-15e5f941f816'),
  (33, 'acd01ef9-0f66-560b-8f30-dc84293d56b7'),
  (33, '0687278b-5629-5b02-82bf-5db05483a132'),
  (34, '60d88ad5-f9fd-52f6-9135-f58a887fb869'),
  (34, '087465aa-06a1-5112-a9d7-001d9422d8f5'),
  (34, '36ab71c8-3d6a-508c-b76a-3e2f72dffb99'),
  (35, '02fb9c54-9210-52f7-9ec3-7188bdf199cd'),
  (35, 'bd6bceae-01a7-58fa-84c6-a40366d6e0a2'),
  (35, 'f96b44d3-0e7c-5025-b13c-fcc9aa7232d1'),
  (36, 'f1c3f79e-1b7d-5cfd-881c-5e6c216df8e9'),
  (36, '9bc5222a-81d5-582d-9568-5ad62fafae9c'),
  (37, '31da66f5-2efe-57a2-8b73-770a0a94fc6d'),
  (37, 'e4fa3a69-a609-5594-8945-5573d035f46d'),
  (38, 'a9bd9dfa-0915-5982-b647-5bf764859879'),
  (38, '42368f38-9e45-506f-bf39-70b817329cf0'),
  (38, '54dbdbfc-d6b1-53d9-bbbb-de35cf9ab23b'),
  (39, 'fb3da46d-8186-5784-9136-6dac5ac9c37c'),
  (39, 'e18fc8cf-a83e-5b9c-884f-7b0e501a80ad'),
  (40, 'c1e9a874-e6fb-58e5-b99a-402e2e5a83f0'),
  (40, 'e22c9037-ef54-5326-8217-9c1bb828315f'),
  (41, 'b3fbe7bc-2810-5574-9b62-ae89d6bb1f4c'),
  (41, '64f39131-b171-5680-be98-63911c3f8d06'),
  (42, '44faa9f7-56f0-52b2-b91b-66a6363991ed'),
  (42, 'fb2f1fa2-cd71-5fb3-a2c0-ac71fed31eac'),
  (42, '41ca1eb2-06bb-5253-9951-7321f735eec9'),
  (43, '9ab2d95e-56ac-53bd-b572-59103e6cca32'),
  (43, 'ef4d6d59-83db-5df5-b183-dcc2a7bffcda'),
  (43, 'c96e73ba-2cc0-51a2-9d62-d210eb044fbd'),
  (44, '33202f9d-0c86-50b2-9d2f-c5f1f2343e25'),
  (44, '45962118-32d7-5d5b-b12b-e849637496de');

CREATE TEMP TABLE link_review_keeper ON COMMIT DROP AS
  SELECT DISTINCT ON (lr.g) lr.g, c.person_id AS keeper_pid
  FROM link_review lr JOIN candidates c ON c.id = lr.cand JOIN persons p ON p.id = c.person_id
  ORDER BY lr.g, (p.photo_url IS NOT NULL OR p.bio IS NOT NULL) DESC,
           (SELECT count(*) FROM candidates x WHERE x.person_id = c.person_id) DESC, c.id;

CREATE TEMP TABLE link_review_move ON COMMIT DROP AS
  SELECT lr.cand, c.person_id AS old_pid, k.keeper_pid
  FROM link_review lr JOIN candidates c ON c.id = lr.cand JOIN link_review_keeper k ON k.g = lr.g
  WHERE c.person_id IS DISTINCT FROM k.keeper_pid;

-- Absorbed persons: every candidacy of theirs moves (so the orphan trigger deletes them).
CREATE TEMP TABLE link_review_gone ON COMMIT DROP AS
  SELECT DISTINCT mv.old_pid, mv.keeper_pid FROM link_review_move mv
  WHERE NOT EXISTS (SELECT 1 FROM candidates c WHERE c.person_id = mv.old_pid
                      AND c.id NOT IN (SELECT cand FROM link_review_move));

UPDATE persons p SET
    photo_url = COALESCE(p.photo_url, s.photo_url),
    gender = COALESCE(p.gender, s.gender),
    education = COALESCE(p.education, s.education),
    date_of_birth = COALESCE(p.date_of_birth, s.date_of_birth),
    state_id = COALESCE(p.state_id, s.state_id),
    region_id = COALESCE(p.region_id, s.region_id),
    district_id = COALESCE(p.district_id, s.district_id),
    bio = COALESCE(p.bio, s.bio),
    wikipedia_url = COALESCE(p.wikipedia_url, s.wikipedia_url),
    caste = COALESCE(p.caste, s.caste),
    religion = COALESCE(p.religion, s.religion)
FROM (SELECT DISTINCT ON (g.keeper_pid) g.keeper_pid, src.*
      FROM link_review_gone g JOIN persons src ON src.id = g.old_pid
      ORDER BY g.keeper_pid, (src.photo_url IS NOT NULL) DESC, (src.bio IS NOT NULL) DESC, src.id) s
WHERE p.id = s.keeper_pid;

UPDATE party_unit_roles r SET person_id = g.keeper_pid FROM link_review_gone g WHERE r.person_id = g.old_pid;

DO $$
DECLARE g record;
BEGIN
  FOR g IN SELECT old_pid::text AS o, keeper_pid::text AS k FROM link_review_gone LOOP
    UPDATE elections SET manifest_url = replace(manifest_url, g.o, g.k) WHERE manifest_url LIKE '%' || g.o || '%';
    UPDATE elections SET manifest_draft = replace(manifest_draft::text, g.o, g.k)::jsonb WHERE manifest_draft::text LIKE '%' || g.o || '%';
  END LOOP;
END $$;

UPDATE candidates c SET person_id = mv.keeper_pid FROM link_review_move mv WHERE c.id = mv.cand;

INSERT INTO seed_runs (name) VALUES ('seed_links_review_2027_states_v2') ON CONFLICT (name) DO NOTHING;

\endif

COMMIT;
