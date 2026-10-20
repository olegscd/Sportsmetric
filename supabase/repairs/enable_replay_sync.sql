-- Apply 20261020030000_replay_suggestions.sql, set YOUTUBE_API_KEY on the app
-- host, and deploy first. Verified channel IDs can then be added in admin.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
UPDATE public.replay_sync_settings SET
  token=COALESCE(token,replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')),
  base_url='https://www.sportsmetric.ph', enabled=true, schedule_configured=true WHERE id;
-- Supabase Cron uses UTC: 20:10 UTC = 04:10 the following day in Manila.
-- Named schedules are replaced on repeat, without creating duplicate jobs.
SELECT cron.schedule('sportsmetric-replay-suggestions','10 20 * * *',$job$
  SELECT net.http_post(
    url:=(SELECT base_url FROM public.replay_sync_settings WHERE id AND enabled) || '/api/cron/replay-suggest',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT token FROM public.replay_sync_settings WHERE id AND enabled)),
    body:='{}'::jsonb,timeout_milliseconds:=60000
  ) WHERE EXISTS(SELECT 1 FROM public.replay_sync_settings WHERE id AND enabled);
$job$);
SELECT jobname,schedule,active FROM cron.job WHERE jobname='sportsmetric-replay-suggestions';
