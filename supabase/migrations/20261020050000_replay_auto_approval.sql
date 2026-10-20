-- Opt-in automatic approval and a resumable scan across every old season.
ALTER TABLE public.replay_sync_settings
  ADD COLUMN auto_approve boolean NOT NULL DEFAULT false,
  ADD COLUMN backfill_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN backfill_finished_at timestamptz;
ALTER TABLE public.replay_scan_cursors ADD COLUMN completed_at timestamptz;

-- Reuse the existing candidate RPC, with '*' meaning every historical season.
DO $$ DECLARE definition text; BEGIN
  definition := pg_get_functiondef('public.replay_candidate_games(text,text)'::regprocedure);
  definition := replace(definition,'g.season_id=target_season', '(target_season=''*'' OR g.season_id=target_season)');
  EXECUTE definition;
END $$;

CREATE FUNCTION public.auto_approve_replays(run_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE r record; approved integer := 0;
BEGIN
  PERFORM 1 FROM public.replay_sync_settings WHERE id AND auto_approve AND lease_id=run_id AND lease_until>now() FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;
  FOR r IN SELECT id,game_id FROM public.replay_suggestions WHERE status='pending' AND score>=0.9 ORDER BY game_id,id LOOP
    BEGIN
      PERFORM public.review_replay_suggestion(r.id,true);
      approved := approved+1;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.replay_issues(id,game_id,code,message)
      VALUES('approval:'||r.game_id,r.game_id,'approval',SQLERRM)
      ON CONFLICT(id) DO UPDATE SET message=EXCLUDED.message,resolved=false,last_seen_at=now();
    END;
  END LOOP;
  RETURN approved;
END $$;

-- One database call per uploads page, rather than one network round-trip per
-- game. The existing snapshot checks, channel checks and rejected-pair guard
-- still apply. Approval updates only the three replay fields.
CREATE FUNCTION public.apply_replay_matches(run_id uuid, suggestions jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE item jsonb; created integer := 0; approved integer := 0;
BEGIN
  PERFORM 1 FROM public.replay_sync_settings WHERE id AND lease_id=run_id AND lease_until>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Replay discovery lease expired'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(suggestions) LOOP
    IF public.store_replay_suggestion(run_id,item) THEN created := created+1; END IF;
  END LOOP;
  approved := public.auto_approve_replays(run_id);
  RETURN jsonb_build_object('created',created,'approved',approved);
END $$;

REVOKE ALL ON FUNCTION public.auto_approve_replays(uuid),public.apply_replay_matches(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.auto_approve_replays(uuid),public.apply_replay_matches(uuid,jsonb) TO service_role;
