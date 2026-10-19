-- Repair admin sign-in when the private session table has not been installed.
-- Safe to rerun. Does not change passwords or modify sports/archive records.
BEGIN;
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_sessions TO service_role;
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON public.admin_sessions(expires_at);
NOTIFY pgrst, 'reload schema';
COMMIT;
