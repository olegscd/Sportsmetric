-- Live games and box scores for the automatic updater.
--  * apply_game_sync accepts LIVE (UPCOMING -> LIVE -> FINAL; never backwards),
--    stores the period and game clock, and refreshes every source alias of a
--    fixture so a stale alias is not mistaken for a manual edit.
--  * apply_game_box_score saves official box scores separately, so stat
--    refreshes never touch the reviewed fixture fields.

CREATE OR REPLACE FUNCTION public.apply_game_sync(run_id uuid, source text, match_key text, proposed jsonb, expected jsonb)
RETURNS text LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $function$
DECLARE current_game public.games; src public.game_sync_sources; next_game public.games; changed boolean; clock_changed boolean := false;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.game_sync_settings WHERE id AND enabled AND lease_id=run_id AND lease_until>now()) THEN
    RAISE EXCEPTION 'Updater is paused or its lease expired';
  END IF;
  SELECT * INTO STRICT src FROM public.game_sync_sources WHERE id=source AND enabled;
  IF NOT EXISTS (SELECT 1 FROM public.seasons WHERE id=src.season_id AND is_active AND league=src.league) THEN RAISE EXCEPTION 'Competition is no longer in progress'; END IF;
  next_game := jsonb_populate_record(NULL::public.games, proposed);
  IF next_game.league IS DISTINCT FROM src.league OR next_game.season_id IS DISTINCT FROM src.season_id THEN RAISE EXCEPTION 'Competition mismatch'; END IF;
  IF (next_game.start_time::timestamptz AT TIME ZONE 'Asia/Manila')::date NOT BETWEEN src.starts_on AND src.ends_on THEN RAISE EXCEPTION 'Game date outside competition'; END IF;
  IF next_game.status NOT IN ('UPCOMING','LIVE','FINAL') OR next_game.home_team_id=next_game.away_team_id THEN RAISE EXCEPTION 'Invalid automatic game update'; END IF;
  IF next_game.status='FINAL' AND (next_game.home_score=next_game.away_score OR next_game.home_score<0 OR next_game.away_score<0) THEN RAISE EXCEPTION 'Invalid final score'; END IF;
  IF next_game.status='LIVE' AND (next_game.home_score IS NULL OR next_game.away_score IS NULL OR next_game.home_score<0 OR next_game.away_score<0) THEN RAISE EXCEPTION 'Invalid live score'; END IF;
  IF EXISTS (SELECT 1 FROM public.game_sync_links l WHERE l.game_id=next_game.id AND l.paused) THEN RETURN 'paused'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(source || ':' || match_key));
  SELECT * INTO current_game FROM public.games WHERE id=next_game.id FOR UPDATE;
  IF FOUND THEN
    IF expected IS NULL OR public.game_sync_snapshot(current_game) IS DISTINCT FROM
      public.game_sync_snapshot(jsonb_populate_record(NULL::public.games, expected)) THEN RAISE EXCEPTION 'Fixture changed during the update; review required'; END IF;
    IF current_game.status='FINAL' AND (next_game.status<>'FINAL' OR current_game.home_score<>next_game.home_score OR current_game.away_score<>next_game.away_score) THEN RAISE EXCEPTION 'Published finals require manual review'; END IF;
    -- A schedule listing never takes a game in progress back to upcoming.
    IF current_game.status='LIVE' AND next_game.status='UPCOMING' THEN RETURN 'unchanged'; END IF;
    changed := public.game_sync_snapshot(current_game) IS DISTINCT FROM public.game_sync_snapshot(next_game);
    IF next_game.status<>'UPCOMING' AND current_game.status<>'FINAL' THEN
      clock_changed := (proposed ? 'quarter_or_set' AND next_game.quarter_or_set IS DISTINCT FROM current_game.quarter_or_set)
        OR (proposed ? 'time_remaining' AND next_game.time_remaining IS DISTINCT FROM current_game.time_remaining);
    END IF;
    IF changed OR clock_changed THEN
      UPDATE public.games SET home_score=next_game.home_score,away_score=next_game.away_score,status=next_game.status,
        start_time=next_game.start_time,venue=next_game.venue,stage=next_game.stage,is_playoff=next_game.is_playoff,
        -- Finals keep the furthest period reached (overtime is never rolled back to Q4).
        quarter_or_set=CASE WHEN current_game.status='FINAL' OR next_game.status='UPCOMING' OR next_game.quarter_or_set IS NULL THEN quarter_or_set
          WHEN next_game.status='FINAL' THEN GREATEST(COALESCE(quarter_or_set,0),next_game.quarter_or_set) ELSE next_game.quarter_or_set END,
        time_remaining=CASE WHEN next_game.status='FINAL' THEN NULL WHEN next_game.status='LIVE' AND proposed ? 'time_remaining' THEN next_game.time_remaining ELSE time_remaining END
        WHERE id=next_game.id;
    END IF;
  ELSE
    IF expected IS NOT NULL THEN RAISE EXCEPTION 'Fixture was deleted during update'; END IF;
    INSERT INTO public.games(id,league,season_id,home_team_id,away_team_id,home_score,away_score,status,start_time,venue,stage,is_playoff,quarter_or_set,time_remaining)
      VALUES(next_game.id,next_game.league,next_game.season_id,next_game.home_team_id,next_game.away_team_id,next_game.home_score,next_game.away_score,next_game.status,next_game.start_time,next_game.venue,next_game.stage,next_game.is_playoff,
        COALESCE(next_game.quarter_or_set,1),CASE WHEN next_game.status='LIVE' THEN next_game.time_remaining END);
    changed := true;
  END IF;
  INSERT INTO public.game_sync_links AS l(source_id,source_key,game_id,snapshot,last_checked_at)
    VALUES(source,match_key,next_game.id,public.game_sync_snapshot(next_game),now())
    ON CONFLICT (source_id,source_key) DO UPDATE SET snapshot=EXCLUDED.snapshot,last_checked_at=now()
    WHERE l.game_id=EXCLUDED.game_id AND NOT l.paused;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source match is already linked to another fixture or paused'; END IF;
  -- Keep every alias of this fixture (schedule entry, live/result entry) in step.
  UPDATE public.game_sync_links l SET snapshot=public.game_sync_snapshot(g)
    FROM public.games g WHERE g.id=next_game.id AND l.game_id=g.id AND NOT l.paused;
  UPDATE public.game_sync_issues SET resolved=true WHERE source_id=source AND source_key=match_key;
  RETURN CASE WHEN changed OR clock_changed THEN 'updated' ELSE 'unchanged' END;
END $function$;

CREATE OR REPLACE FUNCTION public.apply_game_box_score(run_id uuid, game text, box jsonb, new_players jsonb)
RETURNS text LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $function$
DECLARE g public.games;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.game_sync_settings WHERE id AND enabled AND lease_id=run_id AND lease_until>now()) THEN
    RAISE EXCEPTION 'Updater is paused or its lease expired';
  END IF;
  IF jsonb_typeof(box->'home')<>'array' OR jsonb_typeof(box->'away')<>'array'
    OR jsonb_array_length(box->'home')=0 OR jsonb_array_length(box->'away')=0 THEN RAISE EXCEPTION 'Invalid box score'; END IF;
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
  IF g.box_score->'home' = box->'home' AND g.box_score->'away' = box->'away' THEN RETURN 'unchanged'; END IF;
  UPDATE public.games SET box_score=COALESCE(box_score,'{}'::jsonb) || jsonb_build_object('home',box->'home','away',box->'away','syncedAt',now())
    WHERE id=game;
  RETURN 'updated';
END $function$;

REVOKE ALL ON FUNCTION public.apply_game_sync(uuid,text,text,jsonb,jsonb), public.apply_game_box_score(uuid,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_game_sync(uuid,text,text,jsonb,jsonb), public.apply_game_box_score(uuid,text,jsonb,jsonb) TO service_role;

-- One-time repair: aliases left behind before the refresh above existed.
UPDATE public.game_sync_links l SET snapshot=public.game_sync_snapshot(g)
  FROM public.games g
  WHERE g.id=l.game_id AND NOT l.paused AND l.snapshot IS DISTINCT FROM public.game_sync_snapshot(g)
    AND EXISTS (SELECT 1 FROM public.game_sync_links o WHERE o.game_id=l.game_id AND o.source_key<>l.source_key AND NOT o.paused AND o.snapshot = public.game_sync_snapshot(g));
