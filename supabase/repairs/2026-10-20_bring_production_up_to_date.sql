-- Bring the production database up to the schema the current app expects.
--
-- Covers repo migrations 20260915000000 (baseline), 20261019000000 (restrict
-- admin writes), 20261019000200 (sessions + atomic writes) and
-- 20261019000300 (division overrides), adapted to the live project:
--
--   * Drops the four "Public full access <table>" policies. Until they go,
--     the public anon key can insert, update and delete every row.
--   * Skips uniq_players_team_season_jersey (16 duplicate PVL player rows
--     would abort it). 20260915100000_partial_jersey_unique.sql stays pending
--     until those rows are merged.
--   * Skips 20261019000100_add_foreign_keys: equivalent FKs already exist
--     (teams_season_id_fkey, players_team_id_fkey, games_*_fkey ...).
--   * save_sports_seasons inserts an explicit column list, because the live
--     seasons table has a NOT NULL created_at that SELECT * would null out.
--   * Everything is idempotent and runs in one transaction: on any error,
--     nothing changes. Safe to rerun.
--
-- Run it once in the Supabase SQL editor for project "Sportsmetric".
-- Archive data is moved, not changed: the legacy overrides blob in the
-- hidden teams row is copied to uaap_overrides and split into
-- uaap_division_overrides before the teams row is removed.

BEGIN;

-- 1. Seasons ordering and league ---------------------------------------------
ALTER TABLE public.seasons ADD COLUMN IF NOT EXISTS sort_order integer;
ALTER TABLE public.seasons ADD COLUMN IF NOT EXISTS league text;
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY id DESC) AS rn FROM public.seasons WHERE sort_order IS NULL)
UPDATE public.seasons s SET sort_order = ordered.rn FROM ordered WHERE s.id = ordered.id;

-- 2. Value constraints (NOT VALID: existing rows are not re-checked) ---------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'games_status_check') THEN
    ALTER TABLE public.games ADD CONSTRAINT games_status_check
      CHECK (status IN ('LIVE', 'UPCOMING', 'FINAL')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'games_distinct_teams_check') THEN
    ALTER TABLE public.games ADD CONSTRAINT games_distinct_teams_check
      CHECK (home_team_id <> away_team_id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_league_check') THEN
    ALTER TABLE public.teams ADD CONSTRAINT teams_league_check
      CHECK (league IN ('UAAP', 'PBA', 'PVL')) NOT VALID;
  END IF;
END $$;

-- 3. Indexes ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_games_season_id    ON public.games (season_id);
CREATE INDEX IF NOT EXISTS idx_games_league       ON public.games (league);
CREATE INDEX IF NOT EXISTS idx_games_start_time   ON public.games (start_time DESC);
CREATE INDEX IF NOT EXISTS idx_games_status       ON public.games (status);
CREATE INDEX IF NOT EXISTS idx_games_home_team_id ON public.games (home_team_id);
CREATE INDEX IF NOT EXISTS idx_games_away_team_id ON public.games (away_team_id);
CREATE INDEX IF NOT EXISTS idx_players_season_id  ON public.players (season_id);
CREATE INDEX IF NOT EXISTS idx_players_team_id    ON public.players (team_id);
CREATE INDEX IF NOT EXISTS idx_players_person_id  ON public.players (person_id);
CREATE INDEX IF NOT EXISTS idx_teams_season_id    ON public.teams (season_id);
CREATE INDEX IF NOT EXISTS idx_teams_league       ON public.teams (league);
CREATE INDEX IF NOT EXISTS idx_seasons_league     ON public.seasons (league);
CREATE INDEX IF NOT EXISTS idx_seasons_sort_order ON public.seasons (sort_order);

-- 4. Archive overrides: move out of the hidden teams row ---------------------
CREATE TABLE IF NOT EXISTS public.uaap_overrides (
  id text PRIMARY KEY DEFAULT 'default',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now());

INSERT INTO public.uaap_overrides (id, payload, updated_at)
SELECT 'default', t.record, now() FROM public.teams t
WHERE t.id = '__uaap_archive_overrides__' AND t.record IS NOT NULL
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.teams WHERE id = '__uaap_archive_overrides__' AND record IS NOT NULL)
     AND NOT EXISTS (SELECT 1 FROM public.uaap_overrides o JOIN public.teams t
                     ON t.id = '__uaap_archive_overrides__' AND o.id = 'default' AND o.payload = t.record) THEN
    RAISE EXCEPTION 'uaap_overrides does not hold an exact copy of the legacy overrides row; aborting before deleting it.';
  END IF;
END $$;

DELETE FROM public.teams WHERE id = '__uaap_archive_overrides__';

-- 5. Row-level security: public read, no anon/authenticated writes ----------
--    The app writes with the service-role key, which bypasses RLS.
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['seasons', 'teams', 'players', 'games', 'uaap_overrides']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Public full access %s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Public full access" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Allow public read access on %s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Block anon writes on %s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_authenticated_write" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_public_read" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_public_read" ON public.%I FOR SELECT USING (true)', tbl, tbl);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'uaap_overrides') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.uaap_overrides;
  END IF;
END $$;

-- 6. Admin sessions -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL);
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_sessions TO service_role;
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON public.admin_sessions(expires_at);

-- 7. One current season per league ----------------------------------------------
UPDATE public.seasons SET league = CASE
  WHEN id LIKE 'pba%' THEN 'PBA' WHEN id LIKE 'pvl%' THEN 'PVL' ELSE 'UAAP' END
WHERE league IS NULL;
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY league ORDER BY sort_order NULLS LAST, id DESC) AS rn
  FROM public.seasons WHERE is_current)
UPDATE public.seasons SET is_current = false FROM ranked
WHERE seasons.id = ranked.id AND ranked.rn > 1;
ALTER TABLE public.seasons ALTER COLUMN league SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS seasons_one_current_per_league ON public.seasons(league) WHERE is_current;

-- 8. Atomic admin writes --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_sports_seasons(records jsonb) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(192041, 1);
  IF EXISTS (SELECT league FROM jsonb_to_recordset(records) AS r(league text, is_current boolean)
             WHERE is_current GROUP BY league HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Only one current season is allowed per league';
  END IF;
  UPDATE public.seasons SET is_current = false WHERE league IN (
    SELECT league FROM jsonb_to_recordset(records) AS r(league text, is_current boolean) WHERE is_current);
  UPDATE public.seasons SET is_current = false WHERE id IN (
    SELECT id FROM jsonb_to_recordset(records) AS r(id text));
  INSERT INTO public.seasons (id, label, year, is_current, league, sort_order)
  SELECT id, label, coalesce(year, ''), coalesce(is_current, false), league, sort_order
  FROM jsonb_to_recordset(records)
    AS r(id text, label text, year text, is_current boolean, league text, sort_order integer)
  ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, year = EXCLUDED.year,
    is_current = EXCLUDED.is_current, league = EXCLUDED.league, sort_order = EXCLUDED.sort_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_sports_season(target_id text) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM 1 FROM public.seasons WHERE id = target_id FOR UPDATE;
  DELETE FROM public.games WHERE season_id = target_id;
  DELETE FROM public.players WHERE season_id = target_id;
  DELETE FROM public.teams WHERE season_id = target_id;
  DELETE FROM public.seasons WHERE id = target_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_sports_team(target_id text) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM 1 FROM public.teams WHERE id = target_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.games WHERE home_team_id = target_id OR away_team_id = target_id) THEN
    RAISE EXCEPTION 'This team still has games on the schedule. Delete those games first.' USING ERRCODE = '23503';
  END IF;
  DELETE FROM public.players WHERE team_id = target_id;
  DELETE FROM public.teams WHERE id = target_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_game_record_teams() RETURNS trigger
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

CREATE OR REPLACE FUNCTION public.refresh_game_record_teams() RETURNS trigger
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

DROP TRIGGER IF EXISTS games_lock_record_teams ON public.games;
DROP TRIGGER IF EXISTS games_refresh_record_teams ON public.games;
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

-- 9. Versioned per-division archive edits ---------------------------------------
CREATE TABLE IF NOT EXISTS public.uaap_division_overrides (
  season text NOT NULL,
  sport text NOT NULL,
  division text NOT NULL,
  payload jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (season, sport, division));
ALTER TABLE public.uaap_division_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS division_overrides_public_read ON public.uaap_division_overrides;
CREATE POLICY division_overrides_public_read ON public.uaap_division_overrides FOR SELECT USING (true);
GRANT SELECT ON public.uaap_division_overrides TO anon, authenticated;
GRANT ALL ON public.uaap_division_overrides TO service_role;

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
  )) FROM keys CROSS JOIN source s
ON CONFLICT (season, sport, division) DO NOTHING;

CREATE OR REPLACE FUNCTION public.save_uaap_division(
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

NOTIFY pgrst, 'reload schema';
COMMIT;
