BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_sessions TO service_role;
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON public.admin_sessions(expires_at);

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
  IF EXISTS (SELECT league FROM jsonb_to_recordset(records) AS r(league text, is_current boolean)
             WHERE is_current GROUP BY league HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Only one current season is allowed per league';
  END IF;
  UPDATE public.seasons SET is_current = false WHERE league IN (
    SELECT league FROM jsonb_to_recordset(records) AS r(league text, is_current boolean) WHERE is_current);
  -- Also demote input rows before UPSERT so swapping currents is order independent.
  UPDATE public.seasons SET is_current = false WHERE id IN (
    SELECT id FROM jsonb_to_recordset(records) AS r(id text));
  -- Explicit columns: a live seasons table may carry extra NOT NULL columns
  -- (created_at) that a SELECT * from the JSON would set to NULL.
  INSERT INTO public.seasons (id, label, year, is_current, league, sort_order)
  SELECT id, label, coalesce(year, ''), coalesce(is_current, false), league, sort_order
  FROM jsonb_to_recordset(records)
    AS r(id text, label text, year text, is_current boolean, league text, sort_order integer)
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
