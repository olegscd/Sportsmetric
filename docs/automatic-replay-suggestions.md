# Automatic replay suggestions — setup and everyday use

Sportsmetric can find official YouTube videos for finished UAAP, PVL and PBA
games. Supabase starts the scan automatically. You review a suggestion in
**Admin → Games → Replay suggestions**, then choose **Approve replay** to make
it appear as the game's existing slim Replay link. Nothing is published by a
scheduled or manual scan alone.

The UAAP replay display and manual link editor remain the foundation. The new
system fills a private review queue for all three leagues and uses the same
game replay fields after approval. It does not find livestreams or tickets.

## One-time setup

### 1. Create a YouTube API key

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project for Sportsmetric.
3. Enable **YouTube Data API v3** in that project's API Library.
4. In **APIs & Services → Credentials**, create an API key.
5. Restrict the key's API access to **YouTube Data API v3**. These are server
   requests, so a browser HTTP-referrer restriction will not work for this job.
6. In the Sportsmetric app host's production environment settings, add
   `YOUTUBE_API_KEY` with that value, and redeploy the app containing this change.

Google's [getting-started guide](https://developers.google.com/youtube/data/getting-started)
explains enabling the API and creating credentials. There is no Google sign-in
or OAuth consent flow for site visitors: discovery reads public video metadata.

**Environment checklist:**

| Variable | What to do |
| --- | --- |
| `YOUTUBE_API_KEY` | New, server-only key described above. |
| `NEXT_PUBLIC_SUPABASE_URL` | Keep the existing Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Keep the existing public Supabase key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Keep the existing private server key. The replay endpoints need it. |
| `ADMIN_PASSWORD_HASH` or `ADMIN_PASSWORD` | Keep the existing admin login configuration. |
| `NEXT_PUBLIC_IMAGE_HOSTS` | No new setting needed. `i.ytimg.com` is now allowed by the shared image/CSP configuration. |

Do not add a `NEXT_PUBLIC_` prefix to the YouTube key. It is never sent to a
browser or stored in Supabase. The internal scheduler bearer token is generated
in Supabase; you do not need to create or copy it into the app's environment.

### 2. Create the Supabase tables and approval functions

In your Supabase project, open **SQL Editor → New query**. Paste and run the
entire contents of:

`supabase/migrations/20261020030000_replay_suggestions.sql`

Run this migration once, after the existing watch-links migration
`20261020020000_watch_links.sql`. The new tables start with discovery paused and
an empty channel allowlist. Existing game links are not changed.

This migration uses `games.start_time::timestamptz` so production's ISO text
dates work without changing that column's type. The tables and functions are
private to `service_role`; visitors and regular Supabase users cannot read them.

### 3. Add the official channels — start with PVL and PBA

Open the deployed site, sign into **Admin**, choose **Games**, and expand
**Official channels** inside **Replay suggestions**.

The following IDs were checked against links from the leagues' official sites
on October 20, 2026. The allowlist is deliberately not seeded: add the entries
you want to use, after opening the channel and confirming it is the right one.

| League | Channel label | Channel ID to paste | Only covers this league |
| --- | --- | --- | --- |
| PVL | Premier Volleyball League | `UCWU0dPmMnmg2FsZKDTf1PaQ` | Checked |
| PBA | PBA Official | `UC9WkScCyThtumtf9XVO4eWQ` | Checked |
| UAAP | Your verified UAAP source | Add its verified `UC…` ID when ready | Checked only for a dedicated UAAP channel |
| Any covered league | One Sports or another official shared broadcaster | Add its verified `UC…` ID if desired | Unchecked |

Verification links: [PVL's official replay page](https://pvl.ph/videos/galeries-vs-creamline---full-match-preliminary-round-2026-pvl-all-filipino-conference)
links to [the PVL channel](https://www.youtube.com/channel/UCWU0dPmMnmg2FsZKDTf1PaQ).
[PBA's official website](https://www.pba.ph/) links to
[PBA Official](https://www.youtube.com/pbaofficial), whose channel is
[`UC9WkScCyThtumtf9XVO4eWQ`](https://www.youtube.com/channel/UC9WkScCyThtumtf9XVO4eWQ).

Fill the league, channel label and channel ID, then choose **Save official
channel**. A shared broadcaster must be added once for each league it covers.
For example, the same verified One Sports ID could have separate PVL, PBA and
UAAP entries. Keep **Only covers this league** unchecked for that broadcaster.

The checkbox matters: a dedicated PVL channel can identify PVL without writing
"PVL" in every title. A shared broadcaster's video must identify the league or
season in the title or description. A perfect title from a channel outside this
allowlist is still ignored.

Adding the two channels above is enough to start testing PVL and PBA. Adding
UAAP later does not change or replace existing UAAP replay links.

### 4. Test one league before installing the schedule

1. In **Viewing Season**, select a PVL season that already has finished games.
2. Choose **Find recent PVL replays**.
3. Look at **Pending review**. Open the video and confirm the teams, game date
   and video type, then choose **Approve replay** or **Reject**.
4. Visit that game's public card. It should show the existing slim Replay link.
5. Repeat with a PBA season and **Find recent PBA replays**.

The recent button scans that league's recent games across seasons. The pending
list is filtered to **Viewing Season**, so choose the correct season if a scan
finds suggestions you cannot see. Run history reports the overall scan count.

If a season is older, choose **Scan older games in this season**. This removes
the 21-day cutoff for that season, but still requires a finished game and a
video published within 72 hours of its start. Upload histories can be long.
Each pass checks up to six pages (300 uploads) per channel and keeps its place.
If a scan reports more uploads remain, press the same scan button again to
continue. Completing a channel scan resets its cursor so a later scan can
discover newly uploaded videos.

If no suggestions appear, check that the game is marked **FINAL**, has no
existing replay, has valid teams and scores, and is at least six hours old.
Also check channel IDs, run errors and the 72-hour publication window. A replay
uploaded weeks after an old game will need the existing manual replay editor.
You can continue pasting links manually at any time.

### 5. Install the daily Supabase schedule

After deploying and testing, open a second query in **Supabase → SQL Editor**.
Paste and run the entire contents of:

`supabase/repairs/enable_replay_sync.sql`

The repair script generates the private cron token, enables discovery and
creates one named schedule. It is safe to rerun; it replaces the named schedule
rather than adding duplicates. The default site URL is
`https://www.sportsmetric.ph`; change `base_url` in the script if your app is
hosted elsewhere.

The job runs at **4:10 AM Philippine time every day**. Supabase's cron expression
uses **20:10 UTC**, which is 4:10 AM the following day in Manila. It calls the
deployed app's `/api/cron/replay-suggest` endpoint with the private token. Your
computer and browser can be closed.

Check **Supabase → Integrations → Cron** for
`sportsmetric-replay-suggestions`. Then check **Run history and quota** in the
admin panel after its first scheduled run. A dispatched HTTP request alone does
not prove that discovery finished: look for a completed run and its counts.

## What happens automatically

1. Supabase starts the app's daily scan.
2. The app selects finals from **6 hours to 21 days ago** without a replay or a
   pending/approved suggestion. Finished games still come from your existing
   game updater or manual imports.
3. It reads the allowed channels' uploads playlists. A shared channel is fetched
   once per run and matched locally against eligible games.
4. Both teams must be identifiable. Common names such as DLSU/La Salle,
   UST/Santo Tomas, Creamline/CCS and Ginebra/GIN are supported. The video must
   be public, embeddable and finished streaming, and must have been published
   from the game's start through the following 72 hours. A title score, when
   present, must agree with the final result. Individual-set/quarter highlights,
   previews and interviews are excluded.
5. Matches scoring at least 60% enter the private queue. A percentage is a rule
   score to help review; it is not a statistical probability. Equal best matches
   for two games are withheld and appear as an issue.
6. You approve a suggestion. One database transaction rechecks the game and
   official channel, writes only `replay_url`, `replay_kind` and `replay_label`,
   marks it approved and supersedes other pending suggestions for that game.

Approval preserves the latest ticket and livestream links. If someone has
already saved a replay or changed the game's teams, time or final score, the
approval is blocked. The system never replaces an existing replay automatically.
Rejecting a suggestion permanently excludes that video for that game, including
on future manual backfills.

## Video types and everyday review

The queue shows a thumbnail, title, uploader, game date, publication time,
duration, type, score and matching reasons. Explicit "condensed", "full game",
"full match", "replay" or "highlights" wording determines the type. Otherwise,
videos over 45 minutes are full games, videos under 15 minutes are highlights,
and ambiguous lengths default to highlights with a reason shown for review.

Choose **Approve replay** only after opening the video and checking the actual
match. Choose **Reject** for a wrong match. If you want a different URL/type,
reject the suggestion and use the existing game's manual link editor.

The normal routine is simply: **Admin → Games → choose season → review pending
suggestions**. You do not need to run searches every day. You can pause daily
scans with **Pause daily scans**, and still use the manual scan buttons.

## Weekly link checks, limits and troubleshooting

The same scheduled process checks published YouTube replay links weekly, in
batches of up to 50 video IDs per API call. If a video disappears, becomes
private or disallows embedding, it creates an issue. The link stays on the
game until you replace or remove it manually. Large link audits resume in
later runs. A non-YouTube manual replay link is left alone.

The app caps its combined scheduled/manual discovery and link-audit usage at
**3,000 units per Pacific day**, reserving a unit in the database before every
YouTube call, including calls that fail. This follows YouTube's midnight Pacific
quota reset. Channel, playlist-item and video list requests cost one unit each;
the scanner does not call search.list. See Google's
[quota reference](https://developers.google.com/youtube/data/determine_quota_cost).
This cap covers this Sportsmetric database; other apps sharing the API key can
still consume the Google project's quota.

Only one replay scan can run at once. Each pass has a 45-second YouTube deadline
inside the route's 60-second execution allowance. A five-minute lease prevents
overlap; an interrupted run becomes abandoned when the next scan takes over.
Check that your app host supports 60-second route execution. Long scans report
continuation and keep their upload/link checkpoints. If an uploads page token
expires, clear that scope's `next_page_token` in `replay_scan_cursors` to restart
the channel scan. Your reviewed suggestions remain protected.

| Message or situation | What to do |
| --- | --- |
| Replay setup incomplete | Run the new migration in the correct Supabase project. |
| API key not configured | Add `YOUTUBE_API_KEY` on the app host and redeploy. |
| Schedule not installed | Run `supabase/repairs/enable_replay_sync.sql` after deployment. |
| YouTube HTTP 403 | Check the API is enabled, key restrictions and project quota. |
| No pending suggestions | Check the selected season, final status, dates, allowlist and existing links. |
| More uploads remain | Run the same scan again; it resumes from its saved page. |
| Another scan running | Let it finish; after an interruption its lease expires in five minutes. |
| Game changed after matching | Reject the stale suggestion, rescan, or paste the correct replay manually. |
| Dead-link issue | Open the video, edit the game's link if necessary, then choose Mark checked. |
| Daily scan did not start | Check the Supabase Cron job, its HTTP response, base URL and app deployment. |

The repo includes deterministic PVL/PBA scanner/database tests with simulated
YouTube responses and browser tests for review and public display. Live YouTube
verification still requires your own key, applied SQL and configured channels.
