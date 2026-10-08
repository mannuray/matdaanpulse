BEGIN;

-- Credits for the ECI election symbols added on 2026-10-08 for parties prominent in the 2027 states (Goa, Manipur,
-- Uttar Pradesh): Wikimedia Commons "Indian Election Symbol" files under free licences. Idempotent (runs every deploy);
-- the symbol paths are wired in seed_party_symbols.sql.
INSERT INTO image_credits (url, source_url, author, licence) VALUES
  ('/symbols/eci/MAG.png', 'https://commons.wikimedia.org/wiki/File:Indian_Election_Symbol_Lion.png', 'Abilngeorge', 'CC BY-SA 4.0'),
  ('/symbols/eci/GFP.svg', 'https://commons.wikimedia.org/wiki/File:Indian_election_symbol_Coconut.svg', 'Tæ', 'CC BY 3.0'),
  ('/symbols/eci/SBSP.svg', 'https://commons.wikimedia.org/wiki/File:Indian_election_symbol_Key.svg', '√Tæ√', 'Free Art License'),
  ('/symbols/eci/NPF.png', 'https://commons.wikimedia.org/wiki/File:Indian_Election_Symbol_Cock.png', 'Abilngeorge', 'CC BY-SA 4.0'),
  ('/symbols/eci/MSCP.png', 'https://commons.wikimedia.org/wiki/File:Indian_Election_Symbol_Cultivator_Cutting_Crop.png', 'Abilngeorge', 'CC BY-SA 4.0'),
  ('/symbols/eci/KPA.png', 'https://commons.wikimedia.org/wiki/File:Indian_Election_Symbol_Pineapple.png', 'Bdm166', 'CC BY-SA 4.0')
ON CONFLICT (url) DO NOTHING;

COMMIT;
