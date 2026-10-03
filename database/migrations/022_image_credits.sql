-- 022: credits for images we host (person photos, party images): source page, author, licence (spec §6).
CREATE TABLE IF NOT EXISTS image_credits (
    url         text PRIMARY KEY,
    source_url  text NOT NULL,
    author      text,
    licence     text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
