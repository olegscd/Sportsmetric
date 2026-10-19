# Automatic game updates

The updater checks current configured UAAP, PBA and PVL competitions every 15
minutes using Supabase Cron. It runs without an open browser or a local computer.
Open `/admin/updater` (also linked from the admin workspace) to see last successful
source checks, run history and held changes, preview a run, or pause automation.

## What is updated

- PBA: upcoming official schedule plus confirmed LiveStats final scores.
- PVL: upcoming official schedule plus completed recap cards linked to official
  match reports. Results use sets won; existing start times are preserved when
  a recap does not publish the time.
- UAAP: LiveStats results and any fixtures that the tournament feed publishes.
  At setup this source lists completed matches only, so future fixtures published
  only as social-media images still need the schedule builder.

This version preserves player box scores and play-by-play. Import full reports
through the existing importer. New result-only games will not have player stats
until their reports are imported. It never fabricates LIVE or FINAL status from
the clock. A completed basketball match needs an explicit Final label; a PVL
result needs valid final set scores and a linked official report.

## Deployment

1. Apply the three `20261020010*` game-sync migrations after the earlier
   application migrations. They create private state, atomic writes, compatibility
   with legacy text dates, and the official schedule fetch cache.
2. Deploy the app. No new environment secrets are needed; it reuses the existing
   server-only Supabase service-role configuration.
3. Run `supabase/repairs/enable_game_sync.sql` in the project's SQL editor.
   This generates a private internal scheduler token, installs one 15-minute
   job, a separate freshness check, and two PBA schedule fetch/cache jobs,
   and enables updates. Repeat safely.
4. Run a preview in `/admin/updater`, then Check now. Verify the run and all four
   updater and fetch jobs in Supabase Integrations → Cron. A healthy cron dispatch alone
   is not proof of an application run: verify `game_sync_runs` as well.

Local preview: `npx tsx scripts/sync-games.ts` (no writes). Add `--write` only
after reviewing the preview. Scheduled writes are enabled in the database;
preview remains available while automation is paused.

## Protections and review

Source IDs are mapped to existing fixture IDs. Team names must match an explicit
alias uniquely within the same league and season. Unknown teams, missing dates,
invalid scores, duplicate pairings, repeated playoff reschedules, changed final
scores and manually edited linked games are held for review. Date-based source
aliases can reuse a unique unfinished elimination pairing within seven days;
ambiguous reschedules are never guessed. Existing home/away orientation is kept.

Writes compare the current fixture with the previously read version inside one
database transaction. Concurrent manual edits reject the automatic write.
Automation writes basic fixture fields only; it cannot erase box scores. One
database lease prevents overlapping runs; an abandoned lease expires after three
minutes. Every league has an independent fetch outcome and a shared fetch deadline.

The admin shows overdue games after eight hours, source failures and missing
scheduler runs after 45 minutes. The independent health job creates review
items even if the deployed app stops running. These are in-app review notices;
no email or push notification provider is configured.

PBA's public schedule currently rejects the app host but is accessible from
Supabase. Two small jobs fetch that exact official page before the updater and
cache successful HTTP 200 responses privately. The app accepts cache content for
at most 30 minutes, then attempts the direct source and flags any failure. A
failed fetch cannot replace a good cache with an error page.

Use Keep manual control on a linked game to pause it. Resume automatic updates
accepts its current values as the baseline. Published final-score corrections
still require an explicit manual edit. Fix the underlying source/team mapping
for other review items; successful checks resolve them automatically.

## Competition changes

Sources are explicitly pinned to league, season, URL, date range and (for PVL)
conference ID. Only seasons marked current are processed. A changed PVL selected
conference stops that source pending configuration. Do not silently infer new
seasons or create unknown teams. Configure each new competition in the private
`game_sync_sources` table and check its preview before enabling it.

PBA's global upcoming page does not identify competition or phase per fixture.
Its adapter is intended for the pinned current competition's elimination round.
At a conference/phase transition, pause this source and review the mapping and
playoff fixtures before resuming. Existing fixture stage/playoff flags are kept;
new basketball fixtures default to elimination. Conditional PVL playoff fixtures
with TBD teams or If Necessary are withheld until confirmed.

Retention: run history and source links are retained; monitor their size. No
historical games are deleted. The automatic result window is seven days; older
backfills and the full archive stay with the explicit import workflow.
