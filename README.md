# Sportsmetric

Sports statistics and archive for UAAP, PBA, and PVL: live scores, standings,
player profiles, shareable stat cards, and a multi-sport UAAP historical archive.

## Stack

- Next.js 16 (App Router, Turbopack) and React 19
- TypeScript (strict) and Tailwind CSS 4
- Supabase (Postgres + Realtime) for the live season data
- Cheerio + `unpdf` for the admin box-score importer

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open http://localhost:3000. The admin dashboard is at http://localhost:3000/admin.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public read key; RLS allows SELECT only |
| `SUPABASE_SERVICE_ROLE_KEY` | for admin writes | Server-only; bypasses RLS for validated admin mutations |
| `ADMIN_PASSWORD_HASH` | preferred for `/admin` | Salted scrypt hash; generate with `npm run hash:admin-password` using stdin |
| `ADMIN_PASSWORD` | legacy fallback | Use 12+ random characters; ignored when a hash is configured |
| `NEXT_PUBLIC_IMAGE_HOSTS` | optional | Comma-separated exact HTTPS hosts for logos/photos; requires a rebuild |
| `GEMINI_API_KEY` | optional | Only used by the Python archive-extraction scripts |

Never expose the service-role key to the browser. It is deliberately not
prefixed with `NEXT_PUBLIC_`, and all writes go through `/api/admin/mutate`.
When placing a generated scrypt hash in `.env.local`, escape each `$` as `\$`
because Next expands environment variable references. Use the raw hash value
in a deployment platform's secret settings.

## Database

Apply the SQL files in [`supabase/migrations`](supabase/migrations) in filename
order. They create the baseline schema, indexes, RLS policies, the UAAP overrides
tables, foreign keys, and the realtime publication. A bootstrap migration now
creates tables before the older ALTER TABLE migrations, so clean installs work.

Before deploying this follow-up, apply the migrations ending in
`20261019000200_sessions_and_atomic_writes.sql` and
`20261019000300_division_overrides.sql` (plus any earlier unapplied migrations).
They add private admin sessions, atomic deletion/season RPCs, game-record
triggers, one current season per league, and versioned archive division rows.
Existing admin cookies are invalidated; sign in again after migration. Archive
writes and admin sessions require the service-role key, including locally.
The old archive blob and local JSON remain read fallbacks; writes no longer
fall back to disk. Expired session rows can be periodically deleted with
`DELETE FROM public.admin_sessions WHERE expires_at <= now()`.

Seed the demo dataset (requires the service-role key):

```bash
npm run seed:supabase
```

## Checks

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run build       # production build
npm run check       # lint + typecheck
npm test            # unit + PostgreSQL migration/rollback tests (local PGlite)
npx playwright install chromium
npm run test:e2e    # production build + browser tests against local fixture data
```

A CI template at `docs/ci-workflow.yml` runs checks, database tests and production
browser tests. Copy it to `.github/workflows/ci.yml` using credentials with the
GitHub `workflow` permission to activate it. The configured push token currently
cannot create workflows. Browser tests use ports 3100 and 54329 and never write
to the live DB.

Public pages stream server-loaded data for the active season. League/season
changes use `/api/sports`; play-by-play is fetched only when opened. Player
profiles load the person's career seasons; the authenticated admin workspace
keeps the full dataset for imports and optimistic edits. Box scores remain in
season payloads because standings and player averages derive from them. Player
and match grids initially render 36 cards and expand on request.

Logos/photos use Next's image optimizer with an exact host allowlist and no
redirects. Unapproved legacy images show initials until their host is added to
`NEXT_PUBLIC_IMAGE_HOSTS`. Stat-card exports fetch the same cached image URL.
The script CSP uses a fresh nonce on dynamically rendered HTML responses.

## Project layout

| Path | Contents |
| --- | --- |
| `app/` | Routes, server actions, and API handlers |
| `components/` | Client UI (match center, standings, players, admin, UAAP archive) |
| `context/SportsDataContext.tsx` | Client data store and admin mutation wrappers |
| `lib/` | Validation, Supabase mapping, derivations, parsers, utilities |
| `supabase/migrations/` | Postgres schema, RLS, indexes, foreign keys |
| `scripts/` | One-off seeding, import, verification, and archive-extraction tools |
| `data/` | Curated datasets, season transcripts, and generated archive output |

## Data and archive assets

- `data/uaap_standings.json` and `data/uaap_archive_extras.json` are the base
  UAAP archive dataset. Admin edits are stored in Supabase and layered on top.
- `data/seasons/**/*.md` are the season-book transcriptions. The admin report
  viewer reads these; the build only traces the markdown files.
- Photos, PDFs, and generated books are not needed at runtime and are excluded
  from the build trace (see `next.config.ts`). Keep bulk assets out of git or in
  object storage.
