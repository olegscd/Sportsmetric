-- Official play-by-play for the automatic updater.
-- apply_game_box_score gains an optional `plays` array, saved with the box
-- score under the same rules: live and final games only, never over a final
-- box score imported by hand. A NULL `plays` leaves stored plays untouched.

DROP FUNCTION IF EXISTS public.apply_game_box_score(uuid,text,jsonb,jsonb);

CREATE OR REPLACE FUNCTION public.apply_game_box_score(run_id uuid, game text, box jsonb, new_players jsonb, plays jsonb DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $function$
DECLARE g public.games; box_same boolean; plays_same boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.game_sync_settings WHERE id AND enabled AND lease_id=run_id AND lease_until>now()) THEN
    RAISE EXCEPTION 'Updater is paused or its lease expired';
  END IF;
  IF jsonb_typeof(box->'home')<>'array' OR jsonb_typeof(box->'away')<>'array'
    OR jsonb_array_length(box->'home')=0 OR jsonb_array_length(box->'away')=0 THEN RAISE EXCEPTION 'Invalid box score'; END IF;
  IF plays IS NOT NULL AND (jsonb_typeof(plays)<>'array' OR jsonb_array_length(plays)>1000) THEN RAISE EXCEPTION 'Invalid play-by-play'; END IF;
  SELECT * INTO g FROM public.games WHERE id=game FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fixture not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.game_sync_links WHERE game_id=game) THEN RAISE EXCEPTION 'Fixture is not linked to an official source'; END IF;
  IF EXISTS (SELECT 1 FROM public.game_sync_links WHERE game_id=game AND paused) THEN RETURN 'paused'; END IF;
  IF g.status NOT IN ('LIVE','FINAL') THEN RAISE EXCEPTION 'Box scores are saved only for live or final games'; END IF;
  -- A box score imported by hand for a final game stays authoritative.
  IF g.status='FINAL' AND NOT (COALESCE(g.box_score,'{}'::jsonb) ? 'syncedAt')
    AND jsonb_array_length(COALESCE(g.box_score->'home','[]'::jsonb))+jsonb_array_length(COALESCE(g.box_score->'away','[]'::jsonb))>0 THEN RETURN 'kept'; END IF;
  INSERT INTO public.players(id,person_id,name,jersey_number,position,team_id,height,photo_url,season_id,season_averages,rank_badges)
    SELECT p->>'id', p->>'person_id', p->>'name',
      CASE WHEN COALESCE((p->>'jersey_number')::int,0)>0 AND NOT EXISTS (SELECT 1 FROM public.players x WHERE x.team_id=p->>'team_id' AND x.season_id=g.season_id AND x.jersey_number=(p->>'jersey_number')::int)
        THEN (p->>'jersey_number')::int ELSE 0 END,
      p->>'position', p->>'team_id', '', NULL, g.season_id, COALESCE(p->'season_averages','{}'::jsonb), '[]'::jsonb
    FROM jsonb_array_elements(COALESCE(new_players,'[]'::jsonb)) p
    WHERE p->>'team_id' IN (g.home_team_id,g.away_team_id) AND p->>'id' LIKE (p->>'team_id') || '-%'
    ON CONFLICT (id) DO NOTHING;
  box_same := g.box_score->'home' = box->'home' AND g.box_score->'away' = box->'away';
  plays_same := plays IS NULL OR g.play_by_play = plays;
  IF box_same AND plays_same THEN RETURN 'unchanged'; END IF;
  UPDATE public.games SET
    box_score=CASE WHEN box_same THEN box_score ELSE COALESCE(box_score,'{}'::jsonb) || jsonb_build_object('home',box->'home','away',box->'away','syncedAt',now()) END,
    play_by_play=CASE WHEN plays_same THEN play_by_play ELSE plays END
    WHERE id=game;
  RETURN 'updated';
END $function$;

REVOKE ALL ON FUNCTION public.apply_game_box_score(uuid,text,jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_game_box_score(uuid,text,jsonb,jsonb,jsonb) TO service_role;
