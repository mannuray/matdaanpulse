-- Colours for parties that won seats but still had a grey placeholder (#808080 / #9CA3AF). Sourced in
-- scraper/data/parties/colors-v2.json (Wikipedia Module:Political_party, or the party flag; shades adjusted only where a
-- sourced colour clashed with a bigger party on the same map). Fill-only: each UPDATE applies only while the colour is
-- still a grey placeholder, so an admin choice is kept. Idempotent.

UPDATE parties SET color = '#EDFB06' WHERE id = 'JVM' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#F5AD00' WHERE id = 'NPP' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#C9A800' WHERE id = 'SBSP' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#AF7050' WHERE id = 'MAG' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#FFFF00' WHERE id = 'HJCBL' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#7B1E3A' WHERE id = 'NINSHAD' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#99CC99' WHERE id = 'MSCP' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#8E7CC3' WHERE id = 'PP' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#353982' WHERE id = 'GFP' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#FFC000' WHERE id = 'JBSP' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#FFD54F' WHERE id = 'GVP' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#5E7C99' WHERE id = 'KPA' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#800000' WHERE id = 'LIP' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#4DB6AC' WHERE id = 'JP2' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#A8A030' WHERE id = 'RLSP' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#E57373' WHERE id = 'MCO' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#FFF27A' WHERE id = 'JDL' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#1B5E20' WHERE id = 'QED' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#336666' WHERE id = 'UKDP' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#8D4A1C' WHERE id = 'HALP' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#26A69A' WHERE id = 'IEMC' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#A0522D' WHERE id = 'JHJAM' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#9CCC65' WHERE id = 'LJD_BR' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#F61BDF' WHERE id = 'NSAM' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#FFFF00' WHERE id = 'NYMK' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#3F51B5' WHERE id = 'RAKAP' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#E3C773' WHERE id = 'RGP' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#6B8E23' WHERE id = 'RSMP' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#0F7C9E' WHERE id = 'SKD' AND upper(color) IN ('#808080', '#9CA3AF');
UPDATE parties SET color = '#5B4BB0' WHERE id = 'AD_BR' AND upper(color) IN ('#808080', '#9CA3AF');
