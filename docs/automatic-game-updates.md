# Automatic game updates

The updater checks every configured UAAP, PBA and PVL competition whose season
is in progress (`seasons.is_active`) every 15 minutes using Supabase Cron, and
every 2 minutes while a game is live or about to start. It runs without an open
browser or a local computer.
Open `/admin/updater` (also linked from the admin workspace) to see last successful
source checks, run history and held changes, preview a run, or pause automation.

## What is updated

- PBA: upcoming official schedule, live LiveStats scores (period and game
  clock) and confirmed final scores, plus official box scores.
- PVL: upcoming official schedule plus completed recap cards linked to official
  match reports. Results use sets won; existing start times are preserved when
  a recap does not publish the time. PVL has no live feed, so its games move
  from upcoming straight to final.
- UAAP: LiveStats live scores (period and game clock), results, box scores and
  any fixtures that the tournament feed publishes.
  At setup this source lists completed matches only, so future fixtures published
  only as social-media images still need the schedule builder.

### Live basketball games

While the official LiveStats page shows a game in progress, the updater marks it
LIVE and stores the score, period (quarter, or overtime as period 5+) and game
clock (including "Halftime"). Status only moves forward: UPCOMING → LIVE →
FINAL. A schedule listing never takes a live game back to upcoming, and a final
keeps the furthest period reached. Live games are always checked first so they
are never crowded out by other fixtures.

The `sportsmetric-game-sync-live` cron job runs every 2 minutes but only calls
the app when an in-progress season has a game marked LIVE (within 8 hours of its
start) or an upcoming game between 10 minutes before and 4 hours after its
scheduled start. The run lease prevents overlap with the 15-minute job.

### Box scores

- Basketball: the official box score is refreshed on every run while a game is
  live, once more when it goes final, and filled in for recent finals that have
  none. A final box score must add up to the official final score.
- PVL: the box score is read once from the final match report PDF linked from
  the recap card.
- Players who appear in an official box score but not yet on the roster are
  added to that team's season roster automatically.
- A box score imported manually for a final game is never replaced. Automatic
  box scores are tagged with `syncedAt`; anything without that tag is treated as
  manual and kept.
- If a final game's official box score cannot be read or does not match the
  final score, a review item asks for a manual import through the existing
  report importer.

Play-by-play is not synced; it stays with the report importer. The updater never
fabricates LIVE or FINAL status from the clock. A live basketball game needs the
official page to show it in progress with a valid scoreboard; a completed
basketball match needs an explicit Final label; a PVL result needs valid final
set scores and a linked official report.

## Deployment

1. Apply the game-sync migrations in order after the earlier application
   migrations:
   - `20261020010000_game_sync.sql`, `20261020010100_game_sync_legacy_dates.sql`
     and `20261020010200_game_sync_fetch_cache.sql` create private state, atomic
     writes, compatibility with legacy text dates, and the official schedule
     fetch cache.
   - `20261020040000_season_in_progress.sql` adds `seasons.is_active` and lets
     the updater write to every in-progress season, not only the current one.
   - `20261021000000_game_sync_live_box_scores.sql` lets `apply_game_sync`
     store LIVE status, period and clock, and adds `apply_game_box_score` for
     automatic box scores that never overwrite manually imported finals.
2. Deploy the app. No new environment secrets are needed; it reuses the existing
   server-only Supabase service-role configuration.
3. Run `supabase/repairs/enable_game_sync.sql` in the project's SQL editor.
   This generates a private internal scheduler token, installs the 15-minute
   job (`sportsmetric-game-sync`), the 2-minute game-time job
   (`sportsmetric-game-sync-live`), a separate freshness check, and two PBA
   schedule fetch/cache jobs, and enables updates. Repeat safely.
4. Run a preview in `/admin/updater`, then Check now. Verify the run and all five
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
Fixture writes touch only basic fields (teams, scores, status, period, clock,
time, venue, stage). Box scores are saved separately by `apply_game_box_score`,
so a stat refresh never changes reviewed fixture fields and never erases or
replaces a manually imported final box score. One
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
conference ID. Every season marked in progress (`is_active`) is processed, so
several competitions in one league (e.g. UAAP Men's and U16) can run side by
side; the current season is always in progress. A changed PVL selected
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
