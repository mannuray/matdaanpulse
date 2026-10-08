BEGIN;

-- Run once (seed_runs). Links the politicians the person linker held back for review in Goa, Manipur, Punjab,
-- Uttarakhand and Uttar Pradesh (scraper/data/<st>/links-review.json; same name, same seat, two or more years),
-- decided 2026-10-08: every group with one party throughout, a name of two or more words, one candidacy a year and
-- declared ages off by at most 10 years (ECI age declarations are often wrong), plus 22 party-switch or independent
-- groups with a winner, checked by hand. Single-word names, two namesakes in one year, groups without usable ages
-- and common names stay unlinked. Each candidacy moves by candidate id to its group's keeper person (one with a
-- profile, else the most candidacies); the keeper's empty profile fields are filled, and party roles and manifest
-- person ids (published and drafts) that pointed at an absorbed person move to the keeper before the orphan trigger
-- deletes it. Recompute the seat analysis afterwards (scraper/src/recompute-analysis-cli.ts).
SELECT NOT EXISTS (SELECT 1 FROM seed_runs WHERE name = 'seed_links_review_2027_states_v1')
   AS seed_apply \gset
\if :seed_apply

CREATE TEMP TABLE link_review (g int, cand uuid) ON COMMIT DROP;
INSERT INTO link_review (g, cand) VALUES
  (1, 'b1e13277-6b64-5219-9d62-2eb67bed609a'),
  (1, 'aee1918d-d100-573e-a35d-0397e7addbb1'),
  (2, '46f219c4-edc9-5b45-a181-ea255ccc3b19'),
  (2, 'a74a4693-5e84-5bf3-a1f1-aa1aefae4dd7'),
  (3, '30511c24-bd3e-54cc-88cd-f67d85677667'),
  (3, 'cb039321-b14c-54b8-9706-14098d013174'),
  (4, 'e82a57c6-2124-5c70-a160-0d76a86696de'),
  (4, 'db125e1e-f497-56dd-81e5-37d765c39da1'),
  (5, '3fbeea30-3033-5310-8685-437498a585a7'),
  (5, 'd4db15a3-e0db-504a-8990-9fcfd7b497bb'),
  (6, '9de31b2f-d600-530f-9be4-65e9996a3801'),
  (6, '4b883984-a0ce-55e5-8f9b-2b866f4cfdd3'),
  (7, '5e396719-6126-59f7-97d3-7b5a68601dee'),
  (7, 'd4f3ab05-fbcc-5025-be1a-e4a109435acc'),
  (8, '22a19a81-fac9-53ff-bbba-cfb2987b3d3a'),
  (8, '3394cd09-8648-5bc5-b43d-ef85763e230e'),
  (9, 'e2d090f3-fdfe-5aa2-925b-e698a87fbcc0'),
  (9, '23da584a-b903-5ba5-99d8-b9bd493ef7ce'),
  (9, '66b7cd84-af3b-517f-948a-69d5e8478c7c'),
  (10, '5b28e86a-1d9e-50dd-adad-65738fe58a55'),
  (10, '1fe8b94f-3a07-5b40-a089-60c5f78ce4cb'),
  (10, '8d34bbea-4352-59a0-8964-fc8db1d8adc0'),
  (11, '161de071-0014-514c-8da3-48e30802dfb2'),
  (11, '7f23dd91-c9b3-5fe7-bbb0-a5c175823da2'),
  (12, 'fc68fc53-23d5-5296-9b59-5aaa4bbcab2b'),
  (12, '117531b5-0304-529b-afd2-98aa827f5398'),
  (13, 'af41ce77-0df9-5cc0-a8ee-7f2ebb368dd0'),
  (13, 'be3acbf8-7e48-575e-ba24-4c3db27b4875'),
  (14, 'fdb66bd7-b40f-5234-8566-986f87b2814c'),
  (14, 'b33057a6-658f-5a6e-8ddb-a23f2277b891'),
  (15, 'd29e52f1-41a8-57df-9681-e076ce35b1b6'),
  (15, '9f84a883-0b06-5226-a03c-e56d56407640'),
  (16, 'd62c0929-daba-5497-a5c4-5c5c8d0d30b6'),
  (16, '06be93ab-d648-587c-84b5-928348be56b8'),
  (17, '3e970f7a-603e-5693-b2a6-a89150c0d131'),
  (17, 'b47ce25d-4865-541f-9236-c1ced2639e3d'),
  (18, '6265629d-900c-5e2d-8bb6-af8e7e3f821c'),
  (18, '821a7d8b-4d52-5abb-a7c0-a83730aa3c3e'),
  (19, 'f373f97c-c3eb-5d94-a0e1-ff60a5a9c545'),
  (19, 'bc732c42-a8a0-5e62-8944-932d5ac2c4bf'),
  (20, 'ee8baadd-298e-502b-9b1e-442f30dbc40b'),
  (20, '6a94dae7-6f41-5677-9d28-af17fa1759c3'),
  (20, '711adde1-3a4a-59f1-aae0-b7d828d38b12'),
  (21, 'e7a3630d-f297-5101-a457-8230f2675e4d'),
  (21, '552834f8-5181-5638-9c49-4b90ad7181e7'),
  (22, '64327a37-9ba3-53f5-8e2c-254232761153'),
  (22, '71e07a64-1291-5aa3-a70e-46c87fa9f807'),
  (23, '464acdc3-adc6-5ac4-8852-c784f58ca325'),
  (23, '71331524-ef0d-53c0-a19a-b9c30213628a'),
  (24, 'e52413de-c3f5-56c8-856c-f3163b301d2b'),
  (24, 'd85f4dce-ee05-57e5-97a0-f0cf1723bd94'),
  (24, 'c560f26d-bf88-5923-91dd-d2b2925ac4c9'),
  (25, 'ef08894d-10cc-5a7a-b874-0294bcd1d7f3'),
  (25, 'b538dde9-087b-5058-aa73-cf70f55e3993'),
  (26, '9fc09294-4fb4-5116-8d3c-12360a28a92a'),
  (26, '5feb7135-e781-57d7-acfd-85a61da816e5'),
  (27, '8f665bad-1690-52fc-9428-7810c508d922'),
  (27, 'c65feb33-e6d8-5741-b286-e22334328975'),
  (28, '4e6cb719-c1e2-5dd8-abd2-73e7905700ff'),
  (28, 'b97dbefc-fef7-5c57-8e54-2be06fc27ac6'),
  (28, '825b9dbe-0508-5ab1-bea3-8c920d928ba8'),
  (29, 'c2d923ce-9ef1-5e60-bb06-a0df5632d4a5'),
  (29, '5cdfda76-3d6a-5128-825b-0908b47bcb3d'),
  (30, 'b93abc42-1610-5d80-b735-3d37f342176a'),
  (30, '26fdbb4c-08b4-5b14-944e-88438c5bfea9'),
  (31, '9ee8723d-e431-5ae3-a036-ddce3a3e5302'),
  (31, '323569dc-8626-51eb-96df-4e2fe2a6d8d7'),
  (32, '98eb6db3-6328-5f75-a665-f9b833bf8070'),
  (32, '04d85524-be38-5777-8511-8ea807071014'),
  (33, 'beedd07c-0439-5976-a2fa-5b10e888e33a'),
  (33, 'b3a076c3-65f6-5b87-b4a7-3bf395ce5f30'),
  (34, '29f40689-9ae6-51d6-a230-24c51f53fe06'),
  (34, 'ea1952c6-f593-5326-b8ba-47bb43a093ba'),
  (34, '1aa49580-5167-5a98-9f43-fe68130b9211'),
  (35, '7c973854-49fd-5f47-882f-c55223b2f37c'),
  (35, 'e34de084-161a-583b-bd6f-2af841f8e2ef'),
  (35, '16268bbe-d5ef-522e-8921-6de8c4eb6634'),
  (36, 'd5a041bd-0709-5bd2-9c15-928d53191fa1'),
  (36, 'f1e21167-0b20-5561-b0ee-dd705021634c'),
  (36, 'fd84a160-fd2a-58a2-adda-bfd8ae081c20'),
  (37, 'b9dae40e-a113-58ff-9e8e-bfa1fe559d4f'),
  (37, 'c6816811-e9a0-55dd-84e3-7c948f0066b2'),
  (38, '575e98e5-07e0-577e-ada9-19ee8494427c'),
  (38, '0f8f1cab-cccc-50b4-bd21-475affb57e2f'),
  (38, 'cea3eb18-b003-5cbe-9d17-5dbaf68e21bf'),
  (39, '36cc9025-672c-549a-ad81-fdf712e948c4'),
  (39, '0d576b4d-fbae-5c0a-88c4-8b1afd2177ac'),
  (40, '6acb336e-3ac7-5d19-9b9f-79baca7e3bd4'),
  (40, 'be52fe3e-62cc-52ee-bbc7-58c3b3ba3785'),
  (41, '22022f2c-4567-5b8b-9abc-465373e59e79'),
  (41, 'fca74551-bded-5487-aad4-81d6f81bc8a0'),
  (42, '8ab31239-22c6-5423-bd65-48287d8ac413'),
  (42, 'a3c07b18-5a29-5336-84f2-2abd8287e185'),
  (43, '0556c266-35eb-5d3e-a7da-9fdd050b9d84'),
  (43, '8009d8ac-d849-5376-acbe-603318cd1f5b'),
  (44, 'afd645e5-9f7c-58be-9387-e5944b364281'),
  (44, 'c02a64c7-1508-5cb9-bf43-c2627f0cc0b1'),
  (45, '031ba4e3-617e-5fb3-8ad1-fab2aa6a3399'),
  (45, '8539b0a8-3848-5093-b2a3-4d22e1dc94ac'),
  (45, 'da7ac040-4697-5298-bed3-d0ec0b3c6c8c'),
  (46, '3103ef9b-3b65-51be-a550-3314172d6857'),
  (46, '7c649e20-2add-5ee7-8c7f-a221e4ccc6a2'),
  (47, '0c7ab33e-5a3e-543c-88a6-b6277d1413ae'),
  (47, '8fed3bc8-e2a9-547d-b248-376cf6238a1c'),
  (47, '47ce7d43-8157-56d0-884e-cc4a81bdc5eb'),
  (48, '08eb9484-9f6e-5e7b-b3e1-c484d848cd24'),
  (48, '77e5847c-7b7a-5825-b3ab-1ca094872eed'),
  (48, '8cd40d92-0b11-56eb-80db-806703c03846'),
  (49, 'fa093cc3-aad4-548f-a230-af04fcd607b4'),
  (49, '57a93758-6be7-5e43-b63e-1ae6aac3d149'),
  (50, '17133542-a2d2-5885-88e6-9afb63a07fe6'),
  (50, 'f77178c1-d45d-58c9-a02a-b8013c26a0c7'),
  (51, '4b354733-cde5-5b57-adf1-3d9dedc02f22'),
  (51, '0786a9ed-7f2e-58a0-b4e4-d6dc992c4291'),
  (52, '8ebd31de-90b2-508b-98b4-0884e0bbbd9a'),
  (52, '3aa734c1-dc89-5291-82d3-fd91bc27000b'),
  (53, 'aea08931-eb62-505c-9f0c-62e7923f258a'),
  (53, '688061cb-46df-5bfc-8da4-879594095247'),
  (54, 'c6d2a90a-3db6-5839-ba85-0c96d2b12580'),
  (54, '79e2f68d-ee80-5031-8e01-2b0afd80b2e4'),
  (55, 'd2690829-2149-50de-8a97-692a1a9f69af'),
  (55, '7f113c1a-8227-5567-8a04-e251d0811a9e'),
  (55, 'f423da51-0ac0-54c9-858b-4dea93aa331f'),
  (56, '71b19b9b-6e11-5657-8f58-1e113e0436c6'),
  (56, '673e1970-2c1c-58a5-ac04-de3f6474e8ca'),
  (57, '086507c8-2214-5ad8-a746-075549c3260c'),
  (57, '0c6836a8-81f4-5876-a458-1db19f86c14d'),
  (58, '6f3d48b9-d91e-59b0-abd5-d8878751d772'),
  (58, 'a0b92247-ea25-500d-aa7b-533dffaca149'),
  (59, '3c8fe298-cea2-5e15-876c-af652b300279'),
  (59, '6f20ff15-c65f-59d0-9dcd-792644c02e59'),
  (59, '069c47e7-ea90-538e-bb5e-301f99daf364'),
  (60, '619d1e8f-cb4b-5753-811b-52dc46ba09e7'),
  (60, '5675a51b-1f92-5794-a7a8-243173ae2200'),
  (61, '307573e0-bebb-52b8-9662-264cc30bc80f'),
  (61, 'f2a52a53-386e-5edb-a3b2-eb2ee1472c2a'),
  (61, 'e1d5f3b9-d49b-518e-b993-3c2701a8f4bd'),
  (62, '2e42eea7-c800-5b0f-8155-ec95970b301f'),
  (62, 'e948cb79-0a2b-5242-b14a-9acf4f5da39a'),
  (63, 'd83b5eea-054a-5db3-bcb0-209dddc514e2'),
  (63, 'cb3f45e4-dd2c-58b7-9443-2eae874b9b3c'),
  (63, '545aabed-9347-5268-b453-cb93d57dca50'),
  (64, '93002fd9-af72-5c08-a6fb-f31427ab4620'),
  (64, 'f243716d-207f-5ab9-99a6-a5165cef2464'),
  (64, 'fdea654d-3de9-5263-a0b5-7219939264c3'),
  (65, '62283498-298a-516a-9e07-f10c815b7bc1'),
  (65, 'd96b464b-9f0d-5dd0-83a5-c709278c7935'),
  (66, '80a7d6d4-b64b-562c-8f48-fa188ec5a477'),
  (66, 'f2e4d548-cdec-5079-bb19-19e0c7f6be6b'),
  (66, '03187e44-7ece-5ed5-8e23-7bc5d67df98e'),
  (67, '8858acd0-50eb-50ad-9fb5-601b134a59e9'),
  (67, 'b60a1988-82e1-55e0-8328-c6ab2e35315a'),
  (67, '175fe006-e8ed-59f7-8a35-c443e7c27930'),
  (68, '4bfb3db3-104e-595c-b485-a1d2e687150b'),
  (68, 'b1ae76cc-9581-5ddd-ae56-bc0b497c976d'),
  (69, 'a1ddab4d-10b9-56e0-adef-a48c80d35ba2'),
  (69, 'de8570c1-bdb5-5152-b89c-f838f31967c0'),
  (69, 'c16e8cbc-52ec-52ee-972f-7506d7e8229b'),
  (70, 'f9eb8d5b-9e52-53db-9fc7-4c27d7925a48'),
  (70, '1ec0fbf5-0ce3-5372-89bd-cd7be1004b03'),
  (71, '615d9b55-7646-5878-aa7f-7289980ad581'),
  (71, '3e8c8131-2d74-5f41-bcff-d8ecfd0fd5f9'),
  (71, '8e9a73f2-95e3-5c61-8e92-e0fe8cab9030'),
  (72, 'fa46a768-2faf-51bd-ade2-7ee117fbf26d'),
  (72, '4c67dd85-1cff-5495-bb70-f82ac6308e15'),
  (73, 'f10be325-458f-51f2-87c7-2db847120897'),
  (73, 'b2a35a24-7a2e-5737-b951-9f2f479d4dd7'),
  (73, '6793120f-3813-58e0-97a1-ef0e4f951111'),
  (74, '7d26da10-bd7b-5f33-b0ca-c168d0004994'),
  (74, '7471a3c1-8a72-523f-ac8a-9d37a3ee398f'),
  (75, '76fed537-cbee-5c43-8ef5-989f3aaf6f41'),
  (75, '9408ebfb-2c8d-50dd-badb-391968e90c2c'),
  (75, '2353fa1c-4952-500c-b6f2-b1ac3cf7b4b0'),
  (76, 'c5adc8a9-38d9-53bb-b87d-3f742566b3e0'),
  (76, '13fc4294-62f4-5f94-be26-181121b42a9a'),
  (76, '2ba1fa14-3650-5ce4-a5cb-5e621d195dcd'),
  (77, 'f6bbe23a-f9bd-56dd-8fa0-333fb57e92d6'),
  (77, '75fbf93d-8612-549d-a5bc-ce657cfd8c07'),
  (77, 'cb2b55dd-90ef-59d4-a6e7-2b995fb6f116'),
  (78, '27c3738e-71c7-5ddb-a279-cd9a3b97ff59'),
  (78, '0aa94ccd-d688-512e-8bfe-8c62ff90862c'),
  (78, 'dd491282-79af-5712-b954-d20dc6fb3f0e'),
  (79, 'f2bde017-892f-559b-83ab-068981ea8da0'),
  (79, '4d28e5dd-4717-51d7-9b1d-78561afea507'),
  (79, '2928a8f5-ad2a-53ef-b2e9-d63da7fa6690'),
  (80, '114731ad-e1de-55af-bd52-995938abdfd5'),
  (80, '7d755475-c078-537d-a3f0-a9ab13a35c4a'),
  (81, 'b72df910-865a-5f42-a5fa-667549c7e16d'),
  (81, '6345b33d-5ce6-5a17-a5bd-d26ced05359c'),
  (81, 'f32f44f2-f438-57e7-b8e8-12e0b4bfeed9'),
  (82, 'c52574d5-d13e-5c08-aa94-233a30e784d6'),
  (82, '6a35ff8f-d2dc-509d-abc4-ae8b5afdf17d'),
  (82, '8f86dc17-d23e-5924-a434-a983f0e3f546');

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

INSERT INTO seed_runs (name) VALUES ('seed_links_review_2027_states_v1') ON CONFLICT (name) DO NOTHING;

\endif

COMMIT;
