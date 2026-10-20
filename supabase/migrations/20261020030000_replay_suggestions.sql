-- Private replay discovery. Only explicit admin review can write game links.
CREATE TABLE public.replay_sync_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK(id), enabled boolean NOT NULL DEFAULT false,
  schedule_configured boolean NOT NULL DEFAULT false,
  token text, base_url text NOT NULL DEFAULT 'https://www.sportsmetric.ph',
  lease_id uuid, lease_until timestamptz, last_started_at timestamptz,
  last_dead_check_at timestamptz, dead_check_cursor text
);
INSERT INTO public.replay_sync_settings(id) VALUES (true);
CREATE TABLE public.replay_channels (
  league text NOT NULL CHECK(league IN ('UAAP','PBA','PVL')),
  channel_id text NOT NULL CHECK(channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
  label text NOT NULL CHECK(length(trim(label)) BETWEEN 1 AND 60),
  enabled boolean NOT NULL DEFAULT true,
  league_specific boolean NOT NULL DEFAULT false,
  PRIMARY KEY(league,channel_id)
);
-- Intentionally empty: an administrator supplies verified official IDs.
CREATE TABLE public.replay_sync_runs (
  id uuid PRIMARY KEY, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','success','partial','failed','abandoned')),
  season_id text, units_used integer NOT NULL DEFAULT 0,
  candidates integer NOT NULL DEFAULT 0, suggestions_created integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]', summary jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE public.replay_sync_quota (
  day date PRIMARY KEY, units_used integer NOT NULL DEFAULT 0 CHECK(units_used BETWEEN 0 AND 3000)
);
CREATE TABLE public.replay_scan_cursors (
  channel_id text NOT NULL, scope text NOT NULL, next_page_token text,
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(channel_id,scope)
);
CREATE TABLE public.replay_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  league text NOT NULL, video_id text NOT NULL CHECK(video_id ~ '^[A-Za-z0-9_-]{11}$'),
  video_url text NOT NULL CHECK(video_url = 'https://www.youtube.com/watch?v=' || video_id),
  title text NOT NULL, channel_id text NOT NULL, channel_title text NOT NULL,
  published_at timestamptz NOT NULL, duration_seconds integer NOT NULL CHECK(duration_seconds > 0),
  kind text NOT NULL CHECK(kind IN ('full','highlights','condensed')),
  inferred_kind_reason text NOT NULL, score numeric NOT NULL CHECK(score BETWEEN 0.6 AND 1),
  match_reasons jsonb NOT NULL, match_snapshot jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','superseded')),
  created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz,
  UNIQUE(game_id,video_id), FOREIGN KEY(league,channel_id) REFERENCES public.replay_channels(league,channel_id)
);
CREATE INDEX replay_suggestions_pending ON public.replay_suggestions(created_at) WHERE status='pending';
CREATE TABLE public.replay_issues (
  id text PRIMARY KEY, game_id text REFERENCES public.games(id) ON DELETE CASCADE,
  video_id text, code text NOT NULL, message text NOT NULL,
  resolved boolean NOT NULL DEFAULT false, last_seen_at timestamptz NOT NULL DEFAULT now()
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['replay_sync_settings','replay_channels','replay_sync_runs','replay_sync_quota','replay_scan_cursors','replay_suggestions','replay_issues'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  END LOOP;
END $$;

GRANT SELECT ON public.games,public.teams,public.seasons TO service_role;
GRANT UPDATE(replay_url,replay_kind,replay_label) ON public.games TO service_role;

CREATE FUNCTION public.replay_game_snapshot(g public.games) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('status',g.status,'league',g.league,'season_id',g.season_id,
    'home_team_id',g.home_team_id,'away_team_id',g.away_team_id,'home_score',g.home_score,
    'away_score',g.away_score,'start_time',to_char(g.start_time::timestamptz AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
$$;

CREATE FUNCTION public.begin_replay_sync(manual boolean DEFAULT false, target_season text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE rid uuid := gen_random_uuid();
BEGIN
  UPDATE public.replay_sync_settings SET lease_id=rid,lease_until=now()+interval '5 minutes',last_started_at=now()
  WHERE id AND (enabled OR manual) AND (lease_until IS NULL OR lease_until<now());
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.replay_sync_runs SET status='abandoned',finished_at=now()
  WHERE status='running' AND started_at<now()-interval '5 minutes';
  INSERT INTO public.replay_sync_runs(id,season_id) VALUES(rid,target_season);
  RETURN rid;
END $$;

-- Charge BEFORE every HTTP request, including failed requests. The shared
-- daily ceiling also covers manual runs and backfills (YouTube's Pacific day).
CREATE FUNCTION public.reserve_replay_unit(run_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE quota_day date := (now() AT TIME ZONE 'America/Los_Angeles')::date;
BEGIN
  PERFORM 1 FROM public.replay_sync_settings WHERE id AND lease_id=run_id AND lease_until>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Replay discovery lease expired'; END IF;
  INSERT INTO public.replay_sync_quota(day) VALUES(quota_day) ON CONFLICT DO NOTHING;
  UPDATE public.replay_sync_quota SET units_used=units_used+1 WHERE day=quota_day AND units_used<3000;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.replay_sync_runs SET units_used=units_used+1 WHERE id=run_id;
  RETURN true;
END $$;

CREATE FUNCTION public.replay_candidate_games(target_season text DEFAULT NULL, target_league text DEFAULT NULL) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
  SELECT COALESCE(jsonb_agg(public.replay_game_snapshot(g) || jsonb_build_object('id',g.id,
    'home',jsonb_build_object('id',h.id,'name',h.name,'short_name',h.short_name),
    'away',jsonb_build_object('id',a.id,'name',a.name,'short_name',a.short_name),'season_label',s.label)
    ORDER BY g.start_time::timestamptz DESC,g.id),'[]'::jsonb)
  FROM public.games g JOIN public.teams h ON h.id=g.home_team_id JOIN public.teams a ON a.id=g.away_team_id
  JOIN public.seasons s ON s.id=g.season_id
  WHERE g.status='FINAL' AND g.replay_url IS NULL
    AND g.start_time::timestamptz <= now()-interval '6 hours'
    AND ((target_season IS NOT NULL AND g.season_id=target_season)
      OR (target_season IS NULL AND g.start_time::timestamptz>=now()-interval '21 days'))
    AND (target_league IS NULL OR g.league=target_league)
    AND NOT EXISTS(SELECT 1 FROM public.replay_suggestions r WHERE r.game_id=g.id AND r.status IN ('pending','approved'))
$$;

CREATE FUNCTION public.store_replay_suggestion(run_id uuid, suggestion jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE g public.games;
BEGIN
  PERFORM 1 FROM public.replay_sync_settings WHERE id AND lease_id=run_id AND lease_until>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Replay discovery lease expired'; END IF;
  SELECT * INTO g FROM public.games WHERE id=suggestion->>'game_id' FOR UPDATE;
  IF NOT FOUND OR g.status<>'FINAL' OR g.replay_url IS NOT NULL THEN RETURN false; END IF;
  IF public.replay_game_snapshot(g) <> suggestion->'match_snapshot' THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM public.replay_suggestions WHERE game_id=g.id AND status IN ('pending','approved')) THEN RETURN false; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.replay_channels WHERE league=g.league AND channel_id=suggestion->>'channel_id' AND enabled) THEN RETURN false; END IF;
  INSERT INTO public.replay_suggestions(game_id,league,video_id,video_url,title,channel_id,channel_title,published_at,
    duration_seconds,kind,inferred_kind_reason,score,match_reasons,match_snapshot)
  VALUES(g.id,g.league,suggestion->>'video_id',suggestion->>'video_url',suggestion->>'title',suggestion->>'channel_id',
    suggestion->>'channel_title',(suggestion->>'published_at')::timestamptz,(suggestion->>'duration_seconds')::integer,
    suggestion->>'kind',suggestion->>'inferred_kind_reason',(suggestion->>'score')::numeric,suggestion->'match_reasons',suggestion->'match_snapshot')
  ON CONFLICT(game_id,video_id) DO NOTHING;
  -- DO NOTHING preserves rejected rows forever, even on repeated backfills.
  RETURN FOUND;
END $$;

-- Serialize on the game before the suggestion so concurrent approvals cannot
-- overwrite each other or a manually saved replay. Only replay columns change.
CREATE FUNCTION public.review_replay_suggestion(suggestion_id uuid, approve boolean) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE r public.replay_suggestions; g public.games; channel_label text; gid text;
BEGIN
  SELECT game_id INTO gid FROM public.replay_suggestions WHERE id=suggestion_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'This suggestion no longer exists'; END IF;
  SELECT * INTO g FROM public.games WHERE id=gid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This game no longer exists'; END IF;
  SELECT * INTO r FROM public.replay_suggestions WHERE id=suggestion_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This suggestion no longer exists'; END IF;
  IF r.status<>'pending' THEN RAISE EXCEPTION 'This suggestion has already been reviewed'; END IF;
  IF NOT approve THEN
    UPDATE public.replay_suggestions SET status='rejected',reviewed_at=now() WHERE id=suggestion_id;
    RETURN;
  END IF;
  IF g.replay_url IS NOT NULL THEN RAISE EXCEPTION 'This game already has a replay. It was not overwritten'; END IF;
  IF g.status<>'FINAL' OR public.replay_game_snapshot(g)<>r.match_snapshot THEN
    RAISE EXCEPTION 'The game changed after matching. Reject this suggestion and scan again';
  END IF;
  SELECT label INTO channel_label FROM public.replay_channels WHERE league=g.league AND channel_id=r.channel_id AND enabled FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This official channel is no longer enabled'; END IF;
  UPDATE public.games SET replay_url=r.video_url,replay_kind=r.kind,replay_label=channel_label WHERE id=g.id AND replay_url IS NULL;
  UPDATE public.replay_suggestions SET status=CASE WHEN id=suggestion_id THEN 'approved' ELSE 'superseded' END,reviewed_at=now()
  WHERE game_id=g.id AND status='pending';
END $$;

CREATE FUNCTION public.finish_replay_sync(run_id uuid, result_status text, result_summary jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
  UPDATE public.replay_sync_runs SET status=result_status,finished_at=now(),summary=result_summary,
    candidates=COALESCE((result_summary->>'candidates')::integer,0),
    suggestions_created=COALESCE((result_summary->>'suggestions_created')::integer,0),
    errors=COALESCE(result_summary->'errors','[]') WHERE id=run_id AND status='running';
  UPDATE public.replay_sync_settings SET lease_id=NULL,lease_until=NULL WHERE id AND lease_id=run_id;
END $$;

REVOKE ALL ON FUNCTION public.replay_game_snapshot(public.games),public.begin_replay_sync(boolean,text),public.reserve_replay_unit(uuid),
  public.replay_candidate_games(text,text),public.store_replay_suggestion(uuid,jsonb),public.review_replay_suggestion(uuid,boolean),
  public.finish_replay_sync(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.replay_game_snapshot(public.games),public.begin_replay_sync(boolean,text),public.reserve_replay_unit(uuid),
  public.replay_candidate_games(text,text),public.store_replay_suggestion(uuid,jsonb),public.review_replay_suggestion(uuid,boolean),
  public.finish_replay_sync(uuid,text,jsonb) TO service_role;
