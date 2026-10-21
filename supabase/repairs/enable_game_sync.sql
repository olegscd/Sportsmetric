-- Run AFTER the game_sync migration and deployment of /api/cron/game-sync.
-- This enables the existing Sportsmetric app's updater; no external API keys
-- or service-role keys are included in scheduler HTTP requests.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Keep the internal token private, generated inside this database, and stable
-- across repeated setup. The app checks it with a timing-safe comparison.
UPDATE public.game_sync_settings SET
  token=COALESCE(token,replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')),
  base_url='https://www.sportsmetric.ph', enabled=true
WHERE id;

-- Repeating setup replaces this named schedule rather than adding duplicates.
-- PBA currently allows Supabase's network while rejecting the app host. Fetch
-- two minutes before the updater and collect the response one minute later.
SELECT cron.schedule('sportsmetric-pba-schedule-fetch','13,28,43,58 * * * *',$job$
  INSERT INTO public.game_sync_fetch_cache(source_id,request_id,requested_at)
  SELECT s.id,net.http_get(url:='https://www.pba.ph/schedule',
    headers:=jsonb_build_object('User-Agent','Sportsmetric/1.0 (sportsmetric.ph)'),timeout_milliseconds:=10000),now()
  FROM public.game_sync_sources s JOIN public.seasons season ON season.id=s.season_id AND season.is_active
  CROSS JOIN public.game_sync_settings c
  WHERE c.id AND c.enabled AND s.enabled AND s.league='PBA'
  ON CONFLICT(source_id) DO UPDATE SET request_id=EXCLUDED.request_id,requested_at=EXCLUDED.requested_at;
$job$);

SELECT cron.schedule('sportsmetric-pba-schedule-cache','14,29,44,59 * * * *',$job$
  UPDATE public.game_sync_fetch_cache cache SET content=response.content,fetched_at=response.created
  FROM net._http_response response WHERE response.id=cache.request_id
    AND response.status_code=200 AND NOT response.timed_out AND response.error_msg IS NULL
    AND length(response.content) BETWEEN 1 AND 4194304;
$job$);

SELECT cron.schedule('sportsmetric-game-sync','*/15 * * * *',$job$
  SELECT net.http_post(
    url := (SELECT base_url FROM public.game_sync_settings WHERE id AND enabled) || '/api/cron/game-sync',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT token FROM public.game_sync_settings WHERE id AND enabled)),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) WHERE EXISTS (SELECT 1 FROM public.game_sync_settings WHERE id AND enabled);
$job$);

-- Game-time cadence: every 2 minutes, but only while a game is live or due to
-- tip off (10 minutes before to 4 hours after its start, within 8 hours for a
-- game still marked live). The run lease prevents overlap with the 15-minute job.
SELECT cron.schedule('sportsmetric-game-sync-live','*/2 * * * *',$job$
  SELECT net.http_post(
    url := (SELECT base_url FROM public.game_sync_settings WHERE id AND enabled) || '/api/cron/game-sync',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT token FROM public.game_sync_settings WHERE id AND enabled)),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) WHERE EXISTS (SELECT 1 FROM public.game_sync_settings WHERE id AND enabled)
    AND EXISTS (
      SELECT 1 FROM public.games g
      JOIN public.game_sync_sources s ON s.season_id=g.season_id AND s.league=g.league AND s.enabled
      JOIN public.seasons season ON season.id=g.season_id AND season.is_active
      WHERE (g.status='LIVE' AND g.start_time::timestamptz > now()-interval '8 hours')
         OR (g.status='UPCOMING' AND g.start_time::timestamptz BETWEEN now()-interval '4 hours' AND now()+interval '10 minutes'));
$job$);

-- Independent freshness check: HTTP dispatch can succeed while the app fails.
-- This writes review items even if the deployed app never starts its job.
SELECT cron.schedule('sportsmetric-game-sync-health','7,22,37,52 * * * *',$job$
  INSERT INTO public.game_sync_issues(source_id,source_key,message,resolved,last_seen_at)
  SELECT s.id,'scheduler','The scheduled updater has not started in 45 minutes. Check the cron HTTP response and deployment.',false,now()
  FROM public.game_sync_sources s CROSS JOIN public.game_sync_settings c
  WHERE c.id AND c.enabled AND s.enabled AND (c.last_started_at IS NULL OR c.last_started_at < now()-interval '45 minutes')
  ON CONFLICT(source_id,source_key) DO UPDATE SET message=EXCLUDED.message,resolved=false,last_seen_at=now();

  UPDATE public.game_sync_issues SET resolved=true WHERE source_key='scheduler'
  AND EXISTS (SELECT 1 FROM public.game_sync_settings WHERE id AND last_started_at>=now()-interval '45 minutes');
$job$);

SELECT jobname,schedule,active FROM cron.job WHERE jobname IN ('sportsmetric-game-sync','sportsmetric-game-sync-live','sportsmetric-game-sync-health','sportsmetric-pba-schedule-fetch','sportsmetric-pba-schedule-cache');
