# Admin sign-in recovery

## Incorrect password

The admin password belongs to Sportsmetric. A Vercel or Supabase account
password does not sign in to `/admin`. Local `.env.local` settings do not update
the live site's settings.

In Vercel, open the Sportsmetric project's Environment Variables. Ensure the
intended `ADMIN_PASSWORD` is saved for Production. If `ADMIN_PASSWORD_HASH` is
present, it takes precedence, so the password must match that hash. Keep raw
hashes in Vercel; only local `.env` files require escaped dollar signs. Do not
add surrounding quotes or a pasted newline to deployment values.

After a password setting changes, deploy again and try the new deployment at
`https://www.sportsmetric.ph/admin`. Repeated failed attempts can lock an IP for
15 minutes. Never add a public password-check endpoint or bypass the check to
recover access.

## Missing session storage

If `public.admin_sessions` is missing, a correct password cannot create a
session. Run [the session repair](../supabase/repairs/admin_sessions.sql) in
the configured Supabase project's SQL editor. It creates only private session
storage, preserves existing rows, and can be rerun. It does not change a password
or sports/archive data. The later full migration tolerates this prior repair.

The deployment also needs a valid server-only `SUPABASE_SERVICE_ROLE_KEY` from
the same project as `NEXT_PUBLIC_SUPABASE_URL`. An anon key cannot write private
sessions. Never disable row-level security or expose the service key to visitors.

After repair, verify a wrong password fails, a correct password opens the
dashboard, and sign-out invalidates the session. Other unapplied migrations,
including versioned archive writes, remain separate from this session-only fix.
