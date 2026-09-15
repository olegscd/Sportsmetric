-- Baseline schema, indexes, a real home for the UAAP archive overrides, and a
-- fix for RLS policies that did not actually block anonymous writes.
--
-- Everything here is idempotent so it can be applied to an existing project.

-- ===========================================================================
-- 1. Baseline schema
--
-- The original CREATE TABLE statements were never committed, so the schema
-- could not be reproduced from this repo. These definitions match what the
-- application reads and writes (see lib/supabase-data.ts).
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.seasons (
  id          text PRIMARY KEY,
  label       text NOT NULL,
  year        text NOT NULL DEFAULT '',
  is_current  boolean NOT NULL DEFAULT false,
  league      text,
  -- Admin-controlled display order. Without this the reorder buttons in the
  -- seasons tab had nowhere to save to, so the list always snapped back to
  -- id-descending on the next load.
  sort_order  integer
);

ALTER TABLE public.seasons ADD COLUMN IF NOT EXISTS sort_order integer;

-- Seed sort_order from the ordering the app used before (id descending).
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY id DESC) AS rn
  FROM public.seasons
  WHERE sort_order IS NULL
)
UPDATE public.seasons s
SET sort_order = ordered.rn
FROM ordered
WHERE s.id = ordered.id;

CREATE TABLE IF NOT EXISTS public.teams (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  short_name   text NOT NULL,
  logo         text,
  league       text NOT NULL,
  accent_color text NOT NULL DEFAULT '#6B7280',
  season_id    text NOT NULL,
  record       jsonb NOT NULL DEFAULT '{"wins": 0, "losses": 0}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.players (
  id              text PRIMARY KEY,
  person_id       text NOT NULL,
  name            text NOT NULL,
  jersey_number   integer NOT NULL DEFAULT 0,
  position        text NOT NULL DEFAULT 'SG',
  team_id         text NOT NULL,
  height          text NOT NULL DEFAULT '',
  photo_url       text,
  season_id       text NOT NULL,
  season_averages jsonb NOT NULL DEFAULT '{}'::jsonb,
  rank_badges     jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.games (
  id             text PRIMARY KEY,
  league         text NOT NULL,
  season_id      text NOT NULL,
  home_team_id   text NOT NULL,
  away_team_id   text NOT NULL,
  home_score     integer NOT NULL DEFAULT 0,
  away_score     integer NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'UPCOMING',
  start_time     timestamptz NOT NULL DEFAULT now(),
  quarter_or_set integer NOT NULL DEFAULT 0,
  time_remaining text,
  venue          text,
  stage          text,
  is_playoff     boolean DEFAULT false,
  box_score      jsonb NOT NULL DEFAULT '{"home": [], "away": []}'::jsonb,
  play_by_play   jsonb NOT NULL DEFAULT '[]'::jsonb
);

-- Value constraints. Added NOT VALID so pre-existing bad rows do not block the
-- migration; run VALIDATE CONSTRAINT after cleaning any legacy data.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'games_status_check') THEN
    ALTER TABLE public.games
      ADD CONSTRAINT games_status_check
      CHECK (status IN ('LIVE', 'UPCOMING', 'FINAL')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'games_distinct_teams_check') THEN
    ALTER TABLE public.games
      ADD CONSTRAINT games_distinct_teams_check
      CHECK (home_team_id <> away_team_id) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_league_check') THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_league_check
      CHECK (league IN ('UAAP', 'PBA', 'PVL')) NOT VALID;
  END IF;
END
$$;

-- ===========================================================================
-- 2. Indexes
--
-- Every page filters on season_id and league, and the match centre orders by
-- start_time. None of these were indexed, so each request did a sequential
-- scan of the whole table.
-- ===========================================================================

CREATE INDEX IF NOT EXISTS idx_games_season_id      ON public.games (season_id);
CREATE INDEX IF NOT EXISTS idx_games_league         ON public.games (league);
CREATE INDEX IF NOT EXISTS idx_games_start_time     ON public.games (start_time DESC);
CREATE INDEX IF NOT EXISTS idx_games_status         ON public.games (status);
CREATE INDEX IF NOT EXISTS idx_games_home_team_id   ON public.games (home_team_id);
CREATE INDEX IF NOT EXISTS idx_games_away_team_id   ON public.games (away_team_id);

CREATE INDEX IF NOT EXISTS idx_players_season_id    ON public.players (season_id);
CREATE INDEX IF NOT EXISTS idx_players_team_id      ON public.players (team_id);
CREATE INDEX IF NOT EXISTS idx_players_person_id    ON public.players (person_id);

CREATE INDEX IF NOT EXISTS idx_teams_season_id      ON public.teams (season_id);
CREATE INDEX IF NOT EXISTS idx_teams_league         ON public.teams (league);

CREATE INDEX IF NOT EXISTS idx_seasons_league       ON public.seasons (league);
CREATE INDEX IF NOT EXISTS idx_seasons_sort_order   ON public.seasons (sort_order);

-- One jersey number per team per season.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_players_team_season_jersey
  ON public.players (team_id, season_id, jersey_number);

-- ===========================================================================
-- 3. Dedicated table for UAAP archive overrides
--
-- These were stored in a sentinel `teams` row (id '__uaap_archive_overrides__')
-- with the whole JSON blob in the `record` column. That row was invisible to
-- the app's team mapper but would have been destroyed by any re-seed, which
-- deletes all teams.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.uaap_overrides (
  id         text PRIMARY KEY DEFAULT 'default',
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Migrate anything already stored in the sentinel teams row.
INSERT INTO public.uaap_overrides (id, payload, updated_at)
SELECT 'default', t.record, now()
FROM public.teams t
WHERE t.id = '__uaap_archive_overrides__' AND t.record IS NOT NULL
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.teams WHERE id = '__uaap_archive_overrides__';

-- ===========================================================================
-- 4. RLS fix
--
-- The previous policies used `FOR ALL USING (auth.role() != 'anon')`. Postgres
-- only applies USING to SELECT/UPDATE/DELETE; INSERT is checked against
-- WITH CHECK, which was absent. Anonymous inserts were therefore permitted.
-- Replaced with an explicit read policy plus a write policy that sets both.
-- ===========================================================================

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['seasons', 'teams', 'players', 'games', 'uaap_overrides']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS "Allow public read access on %s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Block anon writes on %s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_public_read" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_authenticated_write" ON public.%I', tbl, tbl);

    EXECUTE format(
      'CREATE POLICY "%s_public_read" ON public.%I FOR SELECT USING (true)', tbl, tbl
    );

    -- The service role bypasses RLS entirely, which is how the admin API
    -- writes. This policy covers signed-in Supabase users only; anon gets
    -- nothing beyond SELECT.
    EXECUTE format(
      'CREATE POLICY "%s_authenticated_write" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END
$$;

-- Keep realtime working for the new table.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'uaap_overrides'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.uaap_overrides;
  END IF;
END
$$;
