-- "Current" and "in progress" are different things.
--   is_current: the one season per league shown by default (unchanged rule).
--   is_active:  the season is still being played. Several per league allowed
--               (e.g. UAAP Men's and U16 run side by side).
-- The current season is always in progress; a trigger keeps that true even for
-- writers that only know about is_current (save_sports_seasons).
ALTER TABLE public.seasons ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.seasons_current_is_active() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.is_current THEN NEW.is_active := true; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER seasons_current_is_active
  BEFORE INSERT OR UPDATE OF is_current, is_active ON public.seasons
  FOR EACH ROW EXECUTE FUNCTION public.seasons_current_is_active();

-- Backfill: current seasons, plus any season with fixtures still scheduled in
-- the future. A stale unfinished game from the past does not count.
UPDATE public.seasons SET is_active = true WHERE is_current;
UPDATE public.seasons s SET is_active = true
WHERE EXISTS (SELECT 1 FROM public.games g WHERE g.season_id = s.id
  AND g.status = 'UPCOMING' AND g.start_time::timestamptz > now());

-- The automatic updater may now write to any in-progress season, not only the
-- default one. Patch the existing function body in place (it was already
-- rewritten once by 20261020010100), and fail loudly if the text has moved.
DO $migration$
DECLARE definition text; patched text;
BEGIN
  IF to_regprocedure('public.apply_game_sync(uuid,text,text,jsonb,jsonb)') IS NULL THEN RETURN; END IF;
  definition := pg_get_functiondef('public.apply_game_sync(uuid,text,text,jsonb,jsonb)'::regprocedure);
  patched := replace(definition, 'WHERE id=src.season_id AND is_current AND league=src.league', 'WHERE id=src.season_id AND is_active AND league=src.league');
  patched := replace(patched, 'Competition is no longer current', 'Competition is no longer in progress');
  IF patched = definition AND position('is_active AND league=src.league' IN definition) = 0 THEN
    RAISE EXCEPTION 'apply_game_sync no longer matches the expected season check; update this migration';
  END IF;
  EXECUTE patched;
END $migration$;
