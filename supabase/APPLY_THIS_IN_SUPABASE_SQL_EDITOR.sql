-- ====================================================================
-- SPORTSMETRIC • ALL-IN-ONE SUPABASE MIGRATION SCRIPT
-- Project: prtxiqwsqdlzqcvzyslw (https://prtxiqwsqdlzqcvzyslw.supabase.co)
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ====================================================================

-- ====================================================================
-- FILE: supabase/migrations/20260915000000_baseline_schema_indexes_and_rls_fix.sql
-- ====================================================================

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


-- ====================================================================
-- FILE: supabase/migrations/20260915100000_partial_jersey_unique.sql
-- ====================================================================

-- Jersey 0 is used as "number unknown" when a box score has no jersey.
-- The previous unique index treated 0 like a real number, so ingesting a
-- second unmatched player on the same team failed the whole write.

DROP INDEX IF EXISTS public.uniq_players_team_season_jersey;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_players_team_season_jersey
  ON public.players (team_id, season_id, jersey_number)
  WHERE jersey_number > 0;


-- ====================================================================
-- FILE: supabase/migrations/20261019000000_restrict_admin_writes.sql
-- ====================================================================

-- Admin writes go through the service-role key, which bypasses RLS entirely.
--
-- The baseline migration also granted the `authenticated` role blanket write
-- access. The app never signs users in with Supabase Auth, so that policy only
-- widens the attack surface (for example if anonymous sign-ins are enabled).
-- Anonymous reads are still allowed by the `*_public_read` policies.

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['seasons', 'teams', 'players', 'games', 'uaap_overrides']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_authenticated_write" ON public.%I', tbl, tbl);
  END LOOP;
END
$$;


-- ====================================================================
-- FILE: supabase/migrations/20261019000100_add_foreign_keys.sql
-- ====================================================================

-- Add the foreign keys the original schema was missing.
--
-- Constraints are added NOT VALID so pre-existing orphan rows do not block the
-- migration; PostgreSQL still enforces them for every INSERT/UPDATE. Run
-- `VALIDATE CONSTRAINT` after cleaning any legacy orphans.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_season_fk') THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_season_fk
      FOREIGN KEY (season_id) REFERENCES public.seasons (id) ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'players_season_fk') THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_season_fk
      FOREIGN KEY (season_id) REFERENCES public.seasons (id) ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'players_team_fk') THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_team_fk
      FOREIGN KEY (team_id) REFERENCES public.teams (id) ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'games_season_fk') THEN
    ALTER TABLE public.games
      ADD CONSTRAINT games_season_fk
      FOREIGN KEY (season_id) REFERENCES public.seasons (id) ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'games_home_team_fk') THEN
    ALTER TABLE public.games
      ADD CONSTRAINT games_home_team_fk
      FOREIGN KEY (home_team_id) REFERENCES public.teams (id) ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'games_away_team_fk') THEN
    ALTER TABLE public.games
      ADD CONSTRAINT games_away_team_fk
      FOREIGN KEY (away_team_id) REFERENCES public.teams (id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END
$$;


-- ====================================================================
-- FILE: supabase/migrations/20261019000200_sessions_and_atomic_writes.sql
-- ====================================================================

BEGIN;

CREATE TABLE public.admin_sessions (
  id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_sessions FROM anon, authenticated;
GRANT ALL ON public.admin_sessions TO service_role;
CREATE INDEX admin_sessions_expiry_idx ON public.admin_sessions(expires_at);

-- Backfill with the same prefix convention as inferLeague(). Resolve existing
-- duplicate currents deterministically before enforcing the invariant.
UPDATE public.seasons SET league = CASE
  WHEN id LIKE 'pba%' THEN 'PBA' WHEN id LIKE 'pvl%' THEN 'PVL' ELSE 'UAAP' END
WHERE league IS NULL;
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY league ORDER BY sort_order NULLS LAST, id DESC) AS rn
  FROM public.seasons WHERE is_current
)
UPDATE public.seasons SET is_current = false FROM ranked
WHERE seasons.id = ranked.id AND ranked.rn > 1;
ALTER TABLE public.seasons ALTER COLUMN league SET NOT NULL;
CREATE UNIQUE INDEX seasons_one_current_per_league ON public.seasons(league) WHERE is_current;

CREATE FUNCTION public.save_sports_seasons(records jsonb) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Serialize switches/reorders across instances, and clear old flags before
  -- inserting new ones (one multi-row UPSERT can otherwise hit the index).
  PERFORM pg_advisory_xact_lock(192041, 1);
  IF EXISTS (SELECT league FROM jsonb_populate_recordset(NULL::public.seasons, records)
             WHERE is_current GROUP BY league HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Only one current season is allowed per league';
  END IF;
  UPDATE public.seasons SET is_current = false WHERE league IN (
    SELECT league FROM jsonb_populate_recordset(NULL::public.seasons, records) WHERE is_current
  );
  -- Also demote input rows before UPSERT so swapping currents is order independent.
  UPDATE public.seasons SET is_current = false WHERE id IN (
    SELECT id FROM jsonb_populate_recordset(NULL::public.seasons, records)
  );
  INSERT INTO public.seasons SELECT * FROM jsonb_populate_recordset(NULL::public.seasons, records)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, year = EXCLUDED.year,
    is_current = EXCLUDED.is_current, league = EXCLUDED.league, sort_order = EXCLUDED.sort_order;
END;
$$;

CREATE FUNCTION public.delete_sports_season(target_id text) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM 1 FROM public.seasons WHERE id = target_id FOR UPDATE;
  DELETE FROM public.games WHERE season_id = target_id;
  DELETE FROM public.players WHERE season_id = target_id;
  DELETE FROM public.teams WHERE season_id = target_id;
  DELETE FROM public.seasons WHERE id = target_id;
END;
$$;

CREATE FUNCTION public.delete_sports_team(target_id text) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Block new FK references while checking and deleting.
  PERFORM 1 FROM public.teams WHERE id = target_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.games WHERE home_team_id = target_id OR away_team_id = target_id) THEN
    RAISE EXCEPTION 'This team still has games on the schedule. Delete those games first.' USING ERRCODE = '23503';
  END IF;
  DELETE FROM public.players WHERE team_id = target_id;
  DELETE FROM public.teams WHERE id = target_id;
END;
$$;

-- Lock affected teams BEFORE changing a game, then recompute AFTER the write.
-- The lock serializes concurrent game writers; all work rolls back together.
CREATE FUNCTION public.lock_game_record_teams() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM id FROM public.teams WHERE id IN (
    CASE WHEN TG_OP <> 'INSERT' THEN OLD.home_team_id END,
    CASE WHEN TG_OP <> 'INSERT' THEN OLD.away_team_id END,
    CASE WHEN TG_OP <> 'DELETE' THEN NEW.home_team_id END,
    CASE WHEN TG_OP <> 'DELETE' THEN NEW.away_team_id END
  ) ORDER BY id FOR UPDATE;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.refresh_game_record_teams() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE team_row record;
BEGIN
  FOR team_row IN SELECT id, season_id FROM public.teams WHERE id IN (
    CASE WHEN TG_OP <> 'INSERT' THEN OLD.home_team_id END,
    CASE WHEN TG_OP <> 'INSERT' THEN OLD.away_team_id END,
    CASE WHEN TG_OP <> 'DELETE' THEN NEW.home_team_id END,
    CASE WHEN TG_OP <> 'DELETE' THEN NEW.away_team_id END
  ) ORDER BY id LOOP
    UPDATE public.teams t SET record = (
      SELECT jsonb_build_object(
        'wins', count(*) FILTER (WHERE
          (g.home_team_id = t.id AND g.home_score > g.away_score) OR
          (g.away_team_id = t.id AND g.away_score > g.home_score)),
        'losses', count(*) FILTER (WHERE
          (g.home_team_id = t.id AND g.home_score < g.away_score) OR
          (g.away_team_id = t.id AND g.away_score < g.home_score))
      ) FROM public.games g WHERE g.season_id = t.season_id AND g.status = 'FINAL'
        AND (g.home_team_id = t.id OR g.away_team_id = t.id)
        AND NOT coalesce(g.is_playoff, (g.box_score->>'isPlayoff')::boolean, false)
        AND coalesce(g.stage, g.box_score->>'stage', 'ELIMINATION') = 'ELIMINATION'
    ) WHERE t.id = team_row.id;
  END LOOP;
  RETURN NULL;
END;
$$;
CREATE TRIGGER games_lock_record_teams BEFORE INSERT OR UPDATE OR DELETE ON public.games
FOR EACH ROW EXECUTE FUNCTION public.lock_game_record_teams();
CREATE TRIGGER games_refresh_record_teams AFTER INSERT OR UPDATE OR DELETE ON public.games
FOR EACH ROW EXECUTE FUNCTION public.refresh_game_record_teams();

REVOKE ALL ON FUNCTION public.save_sports_seasons(jsonb), public.delete_sports_season(text),
  public.delete_sports_team(text), public.lock_game_record_teams(), public.refresh_game_record_teams()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_sports_seasons(jsonb), public.delete_sports_season(text),
  public.delete_sports_team(text), public.lock_game_record_teams(), public.refresh_game_record_teams()
  TO service_role;
COMMIT;


-- ====================================================================
-- FILE: supabase/migrations/20261019000300_division_overrides.sql
-- ====================================================================

BEGIN;
CREATE TABLE public.uaap_division_overrides (
  season text NOT NULL,
  sport text NOT NULL,
  division text NOT NULL,
  payload jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (season, sport, division)
);
ALTER TABLE public.uaap_division_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY division_overrides_public_read ON public.uaap_division_overrides FOR SELECT USING (true);
GRANT SELECT ON public.uaap_division_overrides TO anon, authenticated;
GRANT ALL ON public.uaap_division_overrides TO service_role;

-- The old blob stays readable as a fallback. Copy every edited division,
-- including extras-only entries and tombstones, without changing its format.
WITH source AS (SELECT payload FROM public.uaap_overrides WHERE id = 'default'),
keys AS (
  SELECT jsonb_object_keys(coalesce(payload->'tables_overrides', '{}')) AS key FROM source
  UNION SELECT jsonb_object_keys(coalesce(payload->'standings_overrides', '{}')) FROM source
  UNION SELECT jsonb_array_elements_text(coalesce(payload->'deleted_divisions', '[]')) FROM source
  UNION SELECT split_part(e.key, '|', 2) || '|' || split_part(e.key, '|', 1) || '|' || d.key
    FROM source, LATERAL jsonb_each(coalesce(payload->'extras_overrides'->'awards', '{}')) e,
    LATERAL jsonb_each(e.value) d
  UNION SELECT split_part(e.key, '|', 2) || '|' || split_part(e.key, '|', 1) || '|' || d.key
    FROM source, LATERAL jsonb_each(coalesce(payload->'extras_overrides'->'chess_medalists', '{}')) e,
    LATERAL jsonb_each(e.value) d
)
INSERT INTO public.uaap_division_overrides(season, sport, division, payload)
SELECT split_part(key, '|', 1), split_part(key, '|', 2), split_part(key, '|', 3),
  jsonb_strip_nulls(jsonb_build_object(
    'table', s.payload->'tables_overrides'->key,
    'standings', s.payload->'standings_overrides'->key,
    'deleted', coalesce((s.payload->'deleted_divisions') ? key, false),
    'awards', s.payload->'extras_overrides'->'awards'->
      (split_part(key, '|', 2) || '|' || split_part(key, '|', 1))->split_part(key, '|', 3),
    'chess_medalists', s.payload->'extras_overrides'->'chess_medalists'->
      (split_part(key, '|', 2) || '|' || split_part(key, '|', 1))->split_part(key, '|', 3)
  )) FROM keys CROSS JOIN source s;

CREATE FUNCTION public.save_uaap_division(
  target_season text, target_sport text, target_division text,
  changes jsonb, expected_version integer
) RETURNS integer LANGUAGE plpgsql SET search_path = public AS $$
DECLARE next_version integer;
BEGIN
  IF expected_version = 0 THEN
    INSERT INTO public.uaap_division_overrides(season, sport, division, payload)
      VALUES (target_season, target_sport, target_division, changes)
      ON CONFLICT DO NOTHING RETURNING version INTO next_version;
  ELSE
    UPDATE public.uaap_division_overrides SET payload = payload || changes,
      version = version + 1, updated_at = now()
      WHERE season = target_season AND sport = target_sport AND division = target_division
        AND version = expected_version RETURNING version INTO next_version;
  END IF;
  IF next_version IS NULL THEN
    RAISE EXCEPTION 'This division was changed by another editor. Reload the archive before saving.'
      USING ERRCODE = '40001';
  END IF;
  RETURN next_version;
END;
$$;
REVOKE ALL ON FUNCTION public.save_uaap_division(text,text,text,jsonb,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_uaap_division(text,text,text,jsonb,integer) TO service_role;
COMMIT;


