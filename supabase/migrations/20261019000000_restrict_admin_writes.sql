-- Admin writes go through the service-role key, which bypasses RLS entirely.
--
-- The baseline migration also granted the `authenticated` role blanket write
-- access. The app never signs users in with Supabase Auth, so that policy only
-- widens the attack surface (for example if anonymous sign-ins are enabled).
-- Anonymous reads are still allowed by the `*_public_read` policies.

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['seasons', 'teams', 'players', 'games', 'uaap_overrides']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_authenticated_write" ON public.%I', tbl, tbl);
  END LOOP;
END
$$;
