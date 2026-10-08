-- 028: trigram matching for typo-tolerant public search (word_similarity in SearchService). Idempotent; no data.
-- Search is scoped to one election (a few thousand rows at most), so no trigram index is needed.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
