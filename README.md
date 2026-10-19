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
| `ADMIN_PASSWORD` | for `/admin` | Password for the admin dashboard; use 12+ random characters |
| `GEMINI_API_KEY` | optional | Only used by the Python archive-extraction scripts |

Never expose the service-role key to the browser. It is deliberately not
prefixed with `NEXT_PUBLIC_`, and all writes go through `/api/admin/mutate`.

## Database

Apply the SQL files in [`supabase/migrations`](supabase/migrations) in filename
order. They create the baseline schema, indexes, RLS policies, the UAAP overrides
table, foreign keys, and the realtime publication.

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
```

CI runs all of the above on pushes and pull requests.

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
