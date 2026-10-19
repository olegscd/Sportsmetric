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
SELECT cron.schedule('sportsmetric-game-sync','*/15 * * * *',$job$
  SELECT net.http_post(
    url := (SELECT base_url FROM public.game_sync_settings WHERE id AND enabled) || '/api/cron/game-sync',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT token FROM public.game_sync_settings WHERE id AND enabled)),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) WHERE EXISTS (SELECT 1 FROM public.game_sync_settings WHERE id AND enabled);
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

SELECT jobname,schedule,active FROM cron.job WHERE jobname IN ('sportsmetric-game-sync','sportsmetric-game-sync-health');
