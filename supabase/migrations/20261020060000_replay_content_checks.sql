-- Approved replays must show the game. Official channels also upload post-game
-- press conferences titled like results, which the first matcher approved.
-- content_checked_at records that an approved link was re-checked against
-- YouTube's video details (livestream length etc.) by the app.
ALTER TABLE public.replay_suggestions
  ADD COLUMN IF NOT EXISTS content_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS content_note text;
CREATE INDEX IF NOT EXISTS replay_suggestions_unchecked
  ON public.replay_suggestions(created_at) WHERE status = 'approved' AND content_checked_at IS NULL;

-- Withdraw an approved suggestion that turned out not to be a game video.
-- Clears the game's replay only if it still points at this video (a manual
-- replacement is never touched). The row stays 'rejected' so the same video is
-- never suggested for this game again.
CREATE OR REPLACE FUNCTION public.revoke_replay_suggestion(suggestion_id uuid, reason text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE r public.replay_suggestions; gid text;
BEGIN
  SELECT game_id INTO gid FROM public.replay_suggestions WHERE id = suggestion_id;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM 1 FROM public.games WHERE id = gid FOR UPDATE;
  SELECT * INTO r FROM public.replay_suggestions WHERE id = suggestion_id FOR UPDATE;
  IF r.status NOT IN ('approved', 'pending') THEN RETURN false; END IF;
  UPDATE public.games SET replay_url = NULL, replay_kind = NULL, replay_label = NULL
  WHERE id = gid AND replay_url = r.video_url;
  UPDATE public.replay_suggestions
  SET status = 'rejected', reviewed_at = now(), content_checked_at = now(), content_note = left(reason, 300)
  WHERE id = suggestion_id;
  INSERT INTO public.replay_issues(id, game_id, video_id, code, message, resolved, last_seen_at)
  VALUES ('revoked:' || gid || ':' || r.video_id, gid, r.video_id, 'revoked',
    'Removed replay "' || left(r.title, 120) || '": ' || left(reason, 200), true, now())
  ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message, last_seen_at = now();
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.revoke_replay_suggestion(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_replay_suggestion(uuid, text) TO service_role;

-- Clean-up that needs no YouTube call: titles that name a press conference,
-- interview or show, and clips under two minutes. Keep this list in step with
-- NOT_GAME_TITLE in lib/replay-sync/match.ts.
SELECT public.revoke_replay_suggestion(id,
  CASE WHEN duration_seconds < 120 THEN 'Shorter than 2 minutes: a social clip, not a game video.'
       ELSE 'Title marks a press conference, interview, show or promo.' END)
FROM public.replay_suggestions
WHERE status IN ('approved', 'pending')
  AND (duration_seconds < 120
    OR title ~* '(post[[:space:]-]?game|pre[[:space:]-]?game|press[[:space:]-]?con|presser|interview|on ?the ?spot|starting[[:space:]]+lineup|full[[:space:]]+episode|podcast|preview|teaser|promo|trailer|behind the scenes|media day|awarding|ceremony)');

-- Games that just lost a wrong link should be scanned again for the real
-- highlights or full game: restart the historical sweep from the newest upload.
UPDATE public.replay_sync_settings SET backfill_enabled = true, backfill_finished_at = NULL
WHERE id AND EXISTS (SELECT 1 FROM public.replay_suggestions WHERE content_note IS NOT NULL);
UPDATE public.replay_scan_cursors SET next_page_token = NULL, completed_at = NULL
WHERE scope = 'history:all' AND EXISTS (SELECT 1 FROM public.replay_suggestions WHERE content_note IS NOT NULL);
