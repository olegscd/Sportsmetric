-- After the auto-approval migration and app deployment: start a historical
-- sweep with a temporary two-minute worker. Daily discovery keeps its job.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
-- Restart completed checkpoints only when beginning a new sweep.
UPDATE public.replay_scan_cursors SET completed_at=NULL,next_page_token=NULL
WHERE scope='history:all' AND NOT EXISTS(SELECT 1 FROM public.replay_sync_settings WHERE id AND backfill_enabled);
UPDATE public.replay_sync_settings SET auto_approve=true,backfill_enabled=true,backfill_finished_at=NULL,
  token=COALESCE(token,replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')) WHERE id;
SELECT cron.schedule('sportsmetric-replay-backfill','*/2 * * * *',$job$
  SELECT net.http_post(
    url:=(SELECT base_url FROM public.replay_sync_settings WHERE id) || '/api/cron/replay-suggest',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT token FROM public.replay_sync_settings WHERE id)),
    body:='{}'::jsonb,timeout_milliseconds:=60000
  ) WHERE EXISTS(SELECT 1 FROM public.replay_sync_settings WHERE id AND enabled AND backfill_enabled)
    AND COALESCE((SELECT units_used FROM public.replay_sync_quota WHERE day=(now() AT TIME ZONE 'America/Los_Angeles')::date),0)<3000;
  SELECT cron.unschedule('sportsmetric-replay-backfill')
  WHERE NOT EXISTS(SELECT 1 FROM public.replay_sync_settings WHERE id AND backfill_enabled);
$job$);
SELECT jobname,schedule,active FROM cron.job WHERE jobname='sportsmetric-replay-backfill';
