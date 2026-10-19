-- Private automation state. Public readers still see only the existing games.
CREATE TABLE IF NOT EXISTS public.game_sync_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  token text,
  base_url text NOT NULL DEFAULT 'https://www.sportsmetric.ph',
  lease_id uuid,
  lease_until timestamptz,
  last_started_at timestamptz
);
INSERT INTO public.game_sync_settings(id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.game_sync_sources (
  id text PRIMARY KEY,
  league text NOT NULL CHECK (league IN ('UAAP','PBA','PVL')),
  season_id text NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  label text NOT NULL,
  tournament_url text NOT NULL,
  year integer NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL CHECK (ends_on >= starts_on),
  conference_id text,
  enabled boolean NOT NULL DEFAULT true,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error text
);

CREATE TABLE IF NOT EXISTS public.game_sync_links (
  source_id text NOT NULL REFERENCES public.game_sync_sources(id) ON DELETE CASCADE,
  source_key text NOT NULL,
  -- Retain source identities when an editor deletes a game, so the next
  -- scheduled run flags the deletion instead of silently recreating it.
  game_id text NOT NULL,
  paused boolean NOT NULL DEFAULT false,
  snapshot jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(source_id,source_key)
);
CREATE INDEX IF NOT EXISTS game_sync_links_game_idx ON public.game_sync_links(game_id);

CREATE TABLE IF NOT EXISTS public.game_sync_runs (
  id uuid PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','partial','failed','abandoned')),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS game_sync_runs_started_idx ON public.game_sync_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS public.game_sync_issues (
  source_id text NOT NULL REFERENCES public.game_sync_sources(id) ON DELETE CASCADE,
  source_key text NOT NULL,
  game_id text REFERENCES public.games(id) ON DELETE SET NULL,
  message text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(source_id,source_key)
);

DO $$
DECLARE name text;
BEGIN
  FOREACH name IN ARRAY ARRAY['game_sync_settings','game_sync_sources','game_sync_links','game_sync_runs','game_sync_issues'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', name);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', name);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', name);
  END LOOP;
END $$;

INSERT INTO public.game_sync_sources(id,league,season_id,label,tournament_url,year,starts_on,ends_on,conference_id)
SELECT v.* FROM (VALUES
  ('uaap-s89-men','UAAP','uaap-s89-men','UAAP Season 89 Men''s Basketball','https://uaap.livestats.ph/tournaments/uaap-season-89-men-s-basketball',2026,'2026-09-01'::date,'2027-02-28'::date,NULL::text),
  ('pba-gov-cup-50','PBA','pba-gov-cup-50','PBA 50th Season Governors'' Cup','https://pba-api01.actech2.com/tournaments/pba-50th-season-governors-cup',2026,'2026-08-01'::date,'2026-12-31'::date,NULL::text),
  ('pvl-2026-2027-afc','PVL','pvl-2026-2027-afc','PVL 2026–2027 All-Filipino Conference','https://pvl.ph/recap',2026,'2026-10-01'::date,'2027-06-30'::date,'21')
) v(id,league,season_id,label,tournament_url,year,starts_on,ends_on,conference_id)
JOIN public.seasons s ON s.id=v.season_id AND s.league=v.league
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.begin_game_sync() RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE run_id uuid := gen_random_uuid();
BEGIN
  UPDATE public.game_sync_settings SET lease_id=run_id,lease_until=now()+interval '3 minutes',last_started_at=now()
  WHERE id AND enabled AND (lease_until IS NULL OR lease_until < now());
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.game_sync_runs SET status='abandoned',finished_at=now()
  WHERE status='running' AND started_at < now()-interval '3 minutes';
  INSERT INTO public.game_sync_runs(id) VALUES (run_id);
  RETURN run_id;
END $$;

CREATE OR REPLACE FUNCTION public.game_sync_snapshot(g public.games) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('id',g.id,'league',g.league,'season_id',g.season_id,
    'home_team_id',g.home_team_id,'away_team_id',g.away_team_id,
    'home_score',g.home_score,'away_score',g.away_score,'status',g.status,
    'start_time',g.start_time,'venue',g.venue,'stage',g.stage,'is_playoff',g.is_playoff)
$$;

-- Compare-and-save protects manual edits made while the official page loads.
-- Only basic fixture/result fields are written: never box scores or play-by-play.
CREATE OR REPLACE FUNCTION public.apply_game_sync(
  run_id uuid, source text, match_key text, proposed jsonb, expected jsonb
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE current_game public.games; src public.game_sync_sources; next_game public.games; changed boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.game_sync_settings WHERE id AND enabled AND lease_id=run_id AND lease_until>now()) THEN
    RAISE EXCEPTION 'Updater is paused or its lease expired';
  END IF;
  SELECT * INTO STRICT src FROM public.game_sync_sources WHERE id=source AND enabled;
  IF NOT EXISTS (SELECT 1 FROM public.seasons WHERE id=src.season_id AND is_current AND league=src.league) THEN RAISE EXCEPTION 'Competition is no longer current'; END IF;
  next_game := jsonb_populate_record(NULL::public.games, proposed);
  IF next_game.league IS DISTINCT FROM src.league OR next_game.season_id IS DISTINCT FROM src.season_id THEN RAISE EXCEPTION 'Competition mismatch'; END IF;
  IF (next_game.start_time AT TIME ZONE 'Asia/Manila')::date NOT BETWEEN src.starts_on AND src.ends_on THEN RAISE EXCEPTION 'Game date outside competition'; END IF;
  IF next_game.status NOT IN ('UPCOMING','FINAL') OR next_game.home_team_id=next_game.away_team_id THEN RAISE EXCEPTION 'Invalid automatic game update'; END IF;
  IF next_game.status='FINAL' AND (next_game.home_score=next_game.away_score OR next_game.home_score<0 OR next_game.away_score<0) THEN RAISE EXCEPTION 'Invalid final score'; END IF;
  IF EXISTS (SELECT 1 FROM public.game_sync_links l WHERE l.game_id=next_game.id AND l.paused) THEN RETURN 'paused'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(source || ':' || match_key));
  SELECT * INTO current_game FROM public.games WHERE id=next_game.id FOR UPDATE;
  IF FOUND THEN
    IF expected IS NULL OR public.game_sync_snapshot(current_game) IS DISTINCT FROM
      (expected || jsonb_build_object('start_time',(expected->>'start_time')::timestamptz)) THEN RAISE EXCEPTION 'Fixture changed during the update; review required'; END IF;
    IF current_game.status='FINAL' AND (next_game.status<>'FINAL' OR current_game.home_score<>next_game.home_score OR current_game.away_score<>next_game.away_score) THEN RAISE EXCEPTION 'Published finals require manual review'; END IF;
    changed := public.game_sync_snapshot(current_game) IS DISTINCT FROM public.game_sync_snapshot(next_game);
    IF changed THEN
      UPDATE public.games SET home_score=next_game.home_score,away_score=next_game.away_score,status=next_game.status,
        start_time=next_game.start_time,venue=next_game.venue,stage=next_game.stage,is_playoff=next_game.is_playoff,
        time_remaining=CASE WHEN next_game.status='FINAL' THEN NULL ELSE time_remaining END
      WHERE id=next_game.id;
    END IF;
  ELSE
    IF expected IS NOT NULL THEN RAISE EXCEPTION 'Fixture was deleted during update'; END IF;
    INSERT INTO public.games(id,league,season_id,home_team_id,away_team_id,home_score,away_score,status,start_time,venue,stage,is_playoff)
    VALUES(next_game.id,next_game.league,next_game.season_id,next_game.home_team_id,next_game.away_team_id,next_game.home_score,next_game.away_score,next_game.status,next_game.start_time,next_game.venue,next_game.stage,next_game.is_playoff);
    changed := true;
  END IF;
  INSERT INTO public.game_sync_links AS l(source_id,source_key,game_id,snapshot,last_checked_at)
    VALUES(source,match_key,next_game.id,public.game_sync_snapshot(next_game),now())
    ON CONFLICT (source_id,source_key) DO UPDATE SET snapshot=EXCLUDED.snapshot,last_checked_at=now()
    WHERE l.game_id=EXCLUDED.game_id AND NOT l.paused;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source match is already linked to another fixture or paused'; END IF;
  UPDATE public.game_sync_issues SET resolved=true WHERE source_id=source AND source_key=match_key;
  RETURN CASE WHEN changed THEN 'updated' ELSE 'unchanged' END;
END $$;

CREATE OR REPLACE FUNCTION public.finish_game_sync(run_id uuid, result_status text, result_summary jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
  UPDATE public.game_sync_runs SET finished_at=now(),status=result_status,summary=result_summary WHERE id=run_id AND status='running';
  UPDATE public.game_sync_settings SET lease_id=NULL,lease_until=NULL WHERE id AND lease_id=run_id;
END $$;

REVOKE ALL ON FUNCTION public.begin_game_sync(),public.game_sync_snapshot(public.games),public.apply_game_sync(uuid,text,text,jsonb,jsonb),public.finish_game_sync(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_game_sync(),public.game_sync_snapshot(public.games),public.apply_game_sync(uuid,text,text,jsonb,jsonb),public.finish_game_sync(uuid,text,jsonb) TO service_role;
