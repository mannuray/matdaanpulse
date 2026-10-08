BEGIN;

-- Run once (seed_runs). Joins leaders whose candidacies sat on several persons (found 2026-10-08 by matching each
-- manifest leader's name against the state's candidacies, then checked by hand: same seat or a known move, declared
-- ages fitting the years; namesakes, a son and age mismatches left out). Each row moves one candidacy, addressed by
-- candidate id, to the person of the leader's keeper candidacy (the one with the profile, else the latest). The
-- keeper's empty profile fields are filled from the persons it absorbs; party roles and manifest person ids (published
-- manifests and drafts) that pointed at an absorbed person move to the keeper before the orphan trigger deletes it.
-- After this, recompute the seat analysis (person ids decide re-contests): scraper/src/recompute-analysis-cli.ts.
SELECT NOT EXISTS (SELECT 1 FROM seed_runs WHERE name = 'seed_leader_person_merges_v1')
   AS seed_apply \gset
\if :seed_apply

CREATE TEMP TABLE leader_merge (leader text, keeper_cand uuid, cand uuid) ON COMMIT DROP;
INSERT INTO leader_merge (leader, keeper_cand, cand) VALUES
  ('V. S. Achuthanandan', '099b5b5f-5f99-449f-9fe7-a2309227a505', '35035c18-9229-44d1-8c7d-6c4c4e4299fb'),
  ('A. P. Anil Kumar', '0899f992-6045-58f7-966c-311ac14f89cd', '5a16a0a0-02e5-47a7-b831-c7c10d8dd505'),
  ('A. P. Anil Kumar', '0899f992-6045-58f7-966c-311ac14f89cd', '1f84631e-faa0-4b08-90af-2cebcc52b55f'),
  ('A. P. Anil Kumar', '0899f992-6045-58f7-966c-311ac14f89cd', 'cc6901f1-8769-447d-9597-c105e73a19ee'),
  ('Babasaheb Patil', 'b7253682-3567-55d9-ade3-21614242d5fa', '5dfa0499-d80b-53fb-9226-248a2a477152'),
  ('Babasaheb Patil', 'b7253682-3567-55d9-ade3-21614242d5fa', '4c02f8aa-b19b-5782-8160-501934809781'),
  ('Chandrashekhar Bawankule', '2ffca4e8-5920-59ed-8be8-52160145c8ff', '480b95b7-adeb-536f-ab9f-5416d151a59e'),
  ('Chandrashekhar Bawankule', '2ffca4e8-5920-59ed-8be8-52160145c8ff', '767c793c-2215-57f2-8db1-6c7353687b7e'),
  ('Dadaji Bhuse', '35756f0c-765a-5c4b-86ea-13a071f12cfd', '470b9d71-dfcc-531d-8a63-31cb492d0dff'),
  ('Dadaji Bhuse', '35756f0c-765a-5c4b-86ea-13a071f12cfd', '56930950-d537-5678-bf71-fa76c406ca75'),
  ('Dadaji Bhuse', '35756f0c-765a-5c4b-86ea-13a071f12cfd', 'a171a3db-c476-517a-b12f-d31e057449f0'),
  ('Ravindra Chavan', '569b3fa0-8b93-5df4-8891-cd2aaa5ed0ec', '691e9e03-79c3-501f-ac7f-ace1d24bcb93'),
  ('Ravindra Chavan', '569b3fa0-8b93-5df4-8891-cd2aaa5ed0ec', '6cce3c1b-49de-5ab0-92a4-4ad407413aba'),
  ('Dilip Ghosh', '5d9f80a5-327b-5198-a1a6-138121390135', 'f494b99d-0160-49c2-aaaf-c63e4f9dc04d'),
  ('Jaykumar Gore', 'e1c48e00-7f4a-5d7c-be81-92086f7e94d2', 'ce110aed-79d1-513a-b302-7c6a0bcb29e5'),
  ('Jaykumar Gore', 'e1c48e00-7f4a-5d7c-be81-92086f7e94d2', '094ccbd3-f85e-5167-80d5-1ccf7e61c207'),
  ('Jaykumar Gore', 'e1c48e00-7f4a-5d7c-be81-92086f7e94d2', '9e7c7cea-c351-594a-b7ee-db7a8bc57a42'),
  ('Gulabrao Patil', '04d2c84c-c981-5138-8d36-a8201e3fac15', '44b1ea36-32ce-516c-8290-d0cc8c170873'),
  ('Humayun Kabir', '2366a32a-86a1-5d10-868f-482c4bea2d83', '6de86324-3ea0-530d-b18a-1400db9d228a'),
  ('Humayun Kabir', '2366a32a-86a1-5d10-868f-482c4bea2d83', '920d6bfa-c4ef-48d7-8068-c62611881c47'),
  ('Humayun Kabir', '2366a32a-86a1-5d10-868f-482c4bea2d83', 'ebae4bcc-7455-49d7-bdc9-bd80bb879eea'),
  ('Humayun Kabir', '2366a32a-86a1-5d10-868f-482c4bea2d83', 'bb682b07-ba8d-4dcc-bec1-437ab0b163b6'),
  ('J. Jayalalithaa', 'dc2c2a6b-4ccd-42f2-bb86-0c0f14960f4b', '0714f34e-ef31-4d42-bb90-4964590726da'),
  ('Lurinjyoti Gogoi', '967c0422-cc67-5eb0-a3a2-131b8f11a5cd', 'f7dff86b-1ac3-53a6-a02d-b89d0bfa4005'),
  ('Lurinjyoti Gogoi', '967c0422-cc67-5eb0-a3a2-131b8f11a5cd', '3425548c-c274-5ee4-9369-46b454848c68'),
  ('Girish Mahajan', '441431a1-3707-5038-ac75-038f5600e90c', '722d9cdf-a655-5c98-9dfd-3fd46a830657'),
  ('Girish Mahajan', '441431a1-3707-5038-ac75-038f5600e90c', '53a9c30e-b472-5c51-b9da-88a93e5852ce'),
  ('Makrand Jadhav-Patil', 'c9a12232-bb0b-5988-8a57-fc5b228e104d', 'bf95c44f-e881-566b-ab2c-c53e7b277254'),
  ('K. Muraleedharan', '1ce6e8e8-7ef2-5b80-b30e-91be3b0c20fe', '5c14b838-33bd-5587-979f-7feefcce7955'),
  ('N. Rangasamy', 'f7330cfc-89d2-5016-bfa7-e5ce1023d8af', 'c81aa6e1-6b57-4584-a9f1-3ff034cbdfd5'),
  ('N. Rangasamy', 'f7330cfc-89d2-5016-bfa7-e5ce1023d8af', 'd5b1ab0d-d18e-4136-ae3d-612041a8dae8'),
  ('N. Rangasamy', 'f7330cfc-89d2-5016-bfa7-e5ce1023d8af', 'b73ccfb9-7188-492f-a8d0-90a9e1cd0b0b'),
  ('N. Rangasamy', 'f7330cfc-89d2-5016-bfa7-e5ce1023d8af', '5a7e0a81-0c46-5b23-a322-6308655fe0ef'),
  ('V. D. Satheesan', '309676f1-eea8-5a19-a26e-da8e6c50c046', '2f707434-0a70-4f01-98b9-f1f43317866c'),
  ('V. D. Satheesan', '309676f1-eea8-5a19-a26e-da8e6c50c046', '084d1fc8-ffdd-4245-ab6c-212730f10f12'),
  ('V. D. Satheesan', '309676f1-eea8-5a19-a26e-da8e6c50c046', '33de08a4-9c98-40c0-9794-911d0067d4a0'),
  ('K. A. Sengottaiyan', 'd00e6658-73d0-5e1b-83c9-aa9285762f10', '28e3c81c-f52d-4d25-a12b-ffb8fd0cee3a'),
  ('K. A. Sengottaiyan', 'd00e6658-73d0-5e1b-83c9-aa9285762f10', 'a11cafa8-d594-4dfe-a9ec-c33a05011139'),
  ('K. A. Sengottaiyan', 'd00e6658-73d0-5e1b-83c9-aa9285762f10', '979de633-d862-4428-8b30-6d2451c8d6a5'),
  ('Ashish Shelar', '400a0cf8-40ba-5c3c-a84d-05499d817147', 'd8ca95ed-c8dd-5dc5-a15d-8a53a169a961'),
  ('Sanjay Shirsat', '53bdbc6c-260f-575c-8061-4bef2022a0a9', '5269e443-5ff3-5071-a279-cc7add2068b2'),
  ('Sunny Joseph', '9861c101-5ee2-5c19-a608-8110e790ff1e', 'b6328e72-b31a-43ea-b863-b28a57c1c3ce'),
  ('Surjya Kanta Mishra', 'ba20f1e9-8df6-41ff-8518-2e1aab887925', '6d423947-d02a-4286-aac1-13c40c06e8dd'),
  ('Tapas Roy', '06ed7554-9827-5106-8640-4026cb6e1904', 'eb3184ae-d6b1-46c6-95cf-018a5cec85e3'),
  ('Tapas Roy', '06ed7554-9827-5106-8640-4026cb6e1904', 'b795c693-516c-4324-b132-9c28acf015a8'),
  ('Tapas Roy', '06ed7554-9827-5106-8640-4026cb6e1904', '705d0712-92dd-498d-956f-7f8e5156317f'),
  ('Ashok Uike', '8f8bd103-a6ab-5c34-9710-84cf6885d6ad', '7167ed69-1d07-5bad-b4c1-eafc6c77d0f3'),
  ('Ashok Uike', '8f8bd103-a6ab-5c34-9710-84cf6885d6ad', 'aee19804-a6aa-593e-aba8-0b4809f64235'),
  ('Radhakrishna Vikhe Patil', '60c29e76-f924-508e-bb47-ff3be83a752b', '6e1584ca-3576-5132-8259-e7c3bffb38da'),
  ('Radhakrishna Vikhe Patil', '60c29e76-f924-508e-bb47-ff3be83a752b', '4da9a3f7-5990-5d60-82a1-446cb95bff9d'),
  ('Radhakrishna Vikhe Patil', '60c29e76-f924-508e-bb47-ff3be83a752b', 'fc77e8d0-1d09-5512-9629-9755df3d46c0'),
  ('Narhari Zirwal', 'ef585554-045e-5542-92ff-a7c54c33bf32', '7c02eb36-5977-5477-9aff-ca32170ebed7'),
  ('Narhari Zirwal', 'ef585554-045e-5542-92ff-a7c54c33bf32', 'f5e6d526-6dee-5750-9cdd-5942dd1d33d7'),
  ('Narhari Zirwal', 'ef585554-045e-5542-92ff-a7c54c33bf32', '84ee251d-e718-57c6-8cfe-de64deb89cb4'),
  ('Dattatray Bharne', 'dc5795f3-5243-5cd3-9aa7-b77bcf2c3d7a', '2bfd7ded-b8c2-5239-8f1c-62bb676b601f'),
  ('Dattatray Bharne', 'dc5795f3-5243-5cd3-9aa7-b77bcf2c3d7a', '8b6f1755-8247-5a7b-8db2-6c76e7350171'),
  ('Dattatray Bharne', 'dc5795f3-5243-5cd3-9aa7-b77bcf2c3d7a', '4143e4e3-c9af-5d71-8f76-e8cbb27e8588');

CREATE TEMP TABLE leader_merge_move ON COMMIT DROP AS
  SELECT m.leader, m.cand, c.person_id AS old_pid, k.person_id AS keeper_pid
  FROM leader_merge m JOIN candidates c ON c.id = m.cand JOIN candidates k ON k.id = m.keeper_cand
  WHERE c.person_id IS DISTINCT FROM k.person_id;

-- Absorbed persons: every candidacy of theirs moves (so the orphan trigger deletes them).
CREATE TEMP TABLE leader_merge_gone ON COMMIT DROP AS
  SELECT DISTINCT mv.old_pid, mv.keeper_pid FROM leader_merge_move mv
  WHERE NOT EXISTS (SELECT 1 FROM candidates c WHERE c.person_id = mv.old_pid
                      AND c.id NOT IN (SELECT cand FROM leader_merge_move));

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
      FROM leader_merge_gone g JOIN persons src ON src.id = g.old_pid
      ORDER BY g.keeper_pid, (src.photo_url IS NOT NULL) DESC, (src.bio IS NOT NULL) DESC, src.id) s
WHERE p.id = s.keeper_pid;

UPDATE party_unit_roles r SET person_id = g.keeper_pid FROM leader_merge_gone g WHERE r.person_id = g.old_pid;

DO $$
DECLARE g record;
BEGIN
  FOR g IN SELECT old_pid::text AS o, keeper_pid::text AS k FROM leader_merge_gone LOOP
    UPDATE elections SET manifest_url = replace(manifest_url, g.o, g.k) WHERE manifest_url LIKE '%' || g.o || '%';
    UPDATE elections SET manifest_draft = replace(manifest_draft::text, g.o, g.k)::jsonb WHERE manifest_draft::text LIKE '%' || g.o || '%';
  END LOOP;
END $$;

UPDATE candidates c SET person_id = mv.keeper_pid FROM leader_merge_move mv WHERE c.id = mv.cand;

INSERT INTO seed_runs (name) VALUES ('seed_leader_person_merges_v1') ON CONFLICT (name) DO NOTHING;

\endif

COMMIT;
