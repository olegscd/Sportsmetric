-- Where to watch, buy tickets and find replays. Season-level links are the
-- defaults (the season's broadcaster / ticketing partner); game-level links
-- override them for a single fixture. Only official sources belong here.
-- These columns are written by dedicated admin operations, never by the
-- regular game/season upserts, so imports and schedule syncs cannot wipe them.
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS watch_url text,
  ADD COLUMN IF NOT EXISTS watch_label text,
  ADD COLUMN IF NOT EXISTS watch_note text,
  ADD COLUMN IF NOT EXISTS tickets_url text,
  ADD COLUMN IF NOT EXISTS tickets_label text;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS watch_url text,
  ADD COLUMN IF NOT EXISTS tickets_url text,
  ADD COLUMN IF NOT EXISTS replay_url text,
  ADD COLUMN IF NOT EXISTS replay_kind text,
  ADD COLUMN IF NOT EXISTS replay_label text;

ALTER TABLE public.seasons ADD CONSTRAINT seasons_watch_url_https CHECK (watch_url IS NULL OR watch_url ~ '^https://');
ALTER TABLE public.seasons ADD CONSTRAINT seasons_tickets_url_https CHECK (tickets_url IS NULL OR tickets_url ~ '^https://');
ALTER TABLE public.games ADD CONSTRAINT games_watch_url_https CHECK (watch_url IS NULL OR watch_url ~ '^https://');
ALTER TABLE public.games ADD CONSTRAINT games_tickets_url_https CHECK (tickets_url IS NULL OR tickets_url ~ '^https://');
ALTER TABLE public.games ADD CONSTRAINT games_replay_url_https CHECK (replay_url IS NULL OR replay_url ~ '^https://');
ALTER TABLE public.games ADD CONSTRAINT games_replay_kind_valid
  CHECK (replay_kind IS NULL OR (replay_url IS NOT NULL AND replay_kind IN ('full', 'highlights', 'condensed')));
