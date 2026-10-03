-- Party colours that the fill-only profile seeds could not set (they replace only grey placeholders).
-- Each UPDATE applies only while the party still has the old colour, so an admin's choice is never overwritten.
-- RJD: the old lime (#7BD34A) read as neither RJD nor distinct from JD(U)'s teal (#1FA37A); RJD's party green.
UPDATE parties SET color = '#056D05' WHERE id = 'RJD' AND upper(color) = '#7BD34A';
