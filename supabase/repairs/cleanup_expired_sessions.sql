-- Apply 20261019000200_sessions_and_atomic_writes.sql first (it creates
-- public.admin_sessions and its expires_at index). Run in the SQL editor.
-- Installs one daily job that deletes expired admin sessions. Signed-in admins
-- are unaffected: only rows already past expires_at are removed.
CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Supabase Cron uses UTC: 19:40 UTC = 03:40 the following day in Manila.
-- Named schedules are replaced on repeat, without creating duplicate jobs.
SELECT cron.schedule('sportsmetric-admin-session-cleanup','40 19 * * *',$job$
  DELETE FROM public.admin_sessions WHERE expires_at <= now();
$job$);
-- Clear any backlog now instead of waiting for the first scheduled run.
DELETE FROM public.admin_sessions WHERE expires_at <= now();
SELECT jobname,schedule,active FROM cron.job WHERE jobname='sportsmetric-admin-session-cleanup';
