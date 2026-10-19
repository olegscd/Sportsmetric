-- Some official websites reject datacenter requests from the app host. The
-- scheduler can fetch the same public page from Supabase and retain a short,
-- private cache. No credentials or arbitrary URLs are accepted from clients.
CREATE TABLE IF NOT EXISTS public.game_sync_fetch_cache (
  source_id text PRIMARY KEY REFERENCES public.game_sync_sources(id) ON DELETE CASCADE,
  request_id bigint,
  requested_at timestamptz,
  fetched_at timestamptz,
  content text
);
ALTER TABLE public.game_sync_fetch_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_sync_fetch_cache FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.game_sync_fetch_cache TO service_role;
