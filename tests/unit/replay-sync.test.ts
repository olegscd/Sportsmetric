import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { canSuggestVideo, chooseVideoMatch, gameSnapshot, inferReplayKind, scoreReplay, teamAliases, youtubeVideoId,
  type ReplayChannel, type ReplayGame, type ReplayVideo } from "@/lib/replay-sync/match";
import { runReplaySync } from "@/lib/replay-sync/run";
import { durationSeconds, youtubeClient } from "@/lib/replay-sync/youtube";
import { replayTestClient } from "../support/replay-database";

const channel: ReplayChannel = { league: "PVL", channel_id: "UCabcdefghijklmnopqrstuv", label: "Official broadcaster", enabled: true, league_specific: false };
const game: ReplayGame = { id: "pvl-game", league: "PVL", season_id: "pvl-test", season_label: "PVL Test", status: "FINAL",
  start_time: "2026-10-18T10:00:00Z", home_team_id: "ccs", away_team_id: "pldt", home_score: 3, away_score: 1,
  home: { id: "ccs", name: "Creamline Cool Smashers", short_name: "CCS" }, away: { id: "pldt", name: "PLDT High Speed Hitters", short_name: "HSH" } };
const video: ReplayVideo = { id: "abcdefghijk", title: "Creamline vs PLDT | PVL | FULL GAME | 3-1", description: "Official replay",
  channelId: channel.channel_id, channelTitle: "Broadcaster", publishedAt: "2026-10-18T14:00:00Z", durationSeconds: 6000,
  public: true, embeddable: true, live: false };

test("PVL matching requires official uploader, both teams, competition, date and correct score", () => {
  assert.equal(scoreReplay(game, video, channel)?.score, 1);
  assert.equal(scoreReplay(game, { ...video, title: "Creamline vs PLDT | PVL highlights" }, channel)?.kind, "highlights");
  for (const changes of [ { channelId: "fan" }, { title: "Creamline | PVL FULL GAME" },
    { title: "Creamline vs PLDT | FULL GAME" }, { title: "Creamline vs PLDT | PVL 3-2" },
    { publishedAt: "2026-10-17T10:00:00Z" }, { publishedAt: "2026-10-22T10:00:00Z" },
    { public: false }, { embeddable: false }, { live: true }, { title: "PVL Creamline vs PLDT preview" },
    { title: "PVL Creamline vs PLDT - 4th Set Highlights" } ]) {
    assert.equal(scoreReplay(game, { ...video, ...changes }, channel), null, JSON.stringify(changes));
  }
  assert.ok(scoreReplay(game, { ...video, title: "Creamline vs PLDT FULL GAME" }, { ...channel, league_specific: true }));
  assert.equal(scoreReplay(game, video, { ...channel, enabled: false }), null);
});

test("UAAP and PBA aliases keep word boundaries and distinguish Ginebra from San Miguel", () => {
  const uaap: ReplayGame = { ...game, league: "UAAP", season_label: "Season 89", home_score: 80, away_score: 75,
    home: { id: "ust", name: "University of Santo Tomas", short_name: "UST" }, away: { id: "dlsu", name: "De La Salle University", short_name: "DLSU" } };
  assert.ok(scoreReplay(uaap, { ...video, title: "Santo Tomas vs La Salle | UAAP Highlights | 80-75" }, { ...channel, league: "UAAP" }));
  assert.ok(teamAliases({ id: "up", name: "University of the Philippines", short_name: "UP" }, "UAAP").includes("maroons"));
  assert.ok(teamAliases({ id: "adu", name: "Adamson University", short_name: "ADU" }, "UAAP").includes("adamson"));
  const pba: ReplayGame = { ...game, league: "PBA", season_label: "PBA Test", home_score: 100, away_score: 98,
    home: { id: "smb", name: "San Miguel Beermen", short_name: "SMB" }, away: { id: "gin", name: "Barangay Ginebra San Miguel", short_name: "GIN" } };
  assert.equal(scoreReplay(pba, { ...video, title: "Barangay Ginebra San Miguel | PBA FULL GAME" }, { ...channel, league: "PBA" }), null);
  assert.ok(scoreReplay(pba, { ...video, title: "Ginebra vs San Miguel | PBA Highlights | 98-100" }, { ...channel, league: "PBA" }));
  const up = { ...uaap, home: { id: "up", name: "University of the Philippines", short_name: "UP" } };
  assert.equal(scoreReplay(up, { ...video, title: "Super La Salle | UAAP Highlights" }, { ...channel, league: "UAAP" }), null);
});

test("kind inference, rejection history and tied game matching", () => {
  assert.equal(inferReplayKind("Replay", 700).kind, "full");
  assert.equal(inferReplayKind("Condensed FULL GAME", 2000).kind, "condensed");
  assert.equal(inferReplayKind("Highlights", 5000).kind, "highlights");
  assert.equal(inferReplayKind("Match", 2701).kind, "full");
  assert.equal(inferReplayKind("Match", 899).kind, "highlights");
  assert.match(inferReplayKind("Match", 1800).reason, /defaults/);
  assert.equal(durationSeconds("PT1H35M12S"), 5712);
  assert.equal(durationSeconds("P1DT1H"), 90000);
  assert.equal(canSuggestVideo("g", "v", [{ game_id: "g", video_id: "v" }]), false);
  assert.equal(canSuggestVideo("g", "v2", [{ game_id: "g", video_id: "v" }]), true);
  const match = scoreReplay(game, video, channel)!;
  assert.deepEqual(chooseVideoMatch([match, { ...match, game: { ...game, id: "other" } }]), { match: null, ambiguous: true });
  assert.equal(chooseVideoMatch([{ ...match, score: 0.59 }]).match, null);
  assert.equal(youtubeVideoId("https://www.youtube.com/watch?v=abcdefghijk"), "abcdefghijk");
  assert.equal(youtubeVideoId("https://youtu.be/abcdefghijk"), "abcdefghijk");
  assert.equal(youtubeVideoId("https://youtube.com.evil.test/watch?v=abcdefghijk"), null);
});

test("API calls reserve quota before fetching and never expose the API key in errors", async () => {
  let calls = 0;
  const denied = youtubeClient({ key: "secret", reserve: async () => false, signal: new AbortController().signal,
    fetcher: async () => { calls++; return Response.json({}); } });
  await assert.rejects(denied.videos([video.id]), /budget/);
  assert.equal(calls, 0);
  const failed = youtubeClient({ key: "secret", reserve: async () => true, signal: new AbortController().signal,
    fetcher: async () => { throw new Error("https://api.test?key=secret"); } });
  await assert.rejects(failed.videos([video.id]), err => err instanceof Error && !err.message.includes("secret"));
});

test("real discovery and admin approval for PVL/PBA: private tables, leases, idempotence, rejection, quota and dead links", async () => {
  const pg = new PGlite();
  const previousKey = process.env.YOUTUBE_API_KEY;
  process.env.YOUTUBE_API_KEY = "offline-test-key";
  try {
    await pg.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE PUBLICATION supabase_realtime; CREATE SCHEMA auth; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_user::text $$;");
    for (const file of (await readdir("supabase/migrations")).sort()) if (file.endsWith(".sql")) await pg.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    await pg.exec("ALTER TABLE games ALTER COLUMN start_time DROP DEFAULT; ALTER TABLE games ALTER COLUMN start_time TYPE text USING start_time::text;");
    // Supabase grants service_role access to application tables by default.
    await pg.exec("GRANT ALL ON games,teams,seasons TO service_role");
    await pg.exec(`INSERT INTO seasons(id,label,league,is_current) VALUES ('pvl-test','PVL Test','PVL',true),('pba-test','PBA Test','PBA',true);
      INSERT INTO teams(id,name,short_name,league,season_id) VALUES
        ('ccs','Creamline Cool Smashers','CCS','PVL','pvl-test'),('pldt','PLDT High Speed Hitters','HSH','PVL','pvl-test'),
        ('smb','San Miguel Beermen','SMB','PBA','pba-test'),('gin','Barangay Ginebra San Miguel','GIN','PBA','pba-test');
      INSERT INTO games(id,league,season_id,home_team_id,away_team_id,home_score,away_score,status,start_time,watch_url,tickets_url) VALUES
        ('pvl-game','PVL','pvl-test','ccs','pldt',3,1,'FINAL',(now()-interval '2 days')::text,'https://watch.example/pvl','https://tickets.example/pvl'),
        ('pba-game','PBA','pba-test','smb','gin',100,98,'FINAL',(now()-interval '2 days')::text,'https://watch.example/pba','https://tickets.example/pba');
      INSERT INTO replay_channels(league,channel_id,label) VALUES ('PVL','UCabcdefghijklmnopqrstuv','Official broadcaster'),('PBA','UCabcdefghijklmnopqrstuv','Official broadcaster');`);
    for (const role of ["anon", "authenticated"]) {
      await pg.exec(`SET ROLE ${role}`);
      for (const table of ["replay_channels", "replay_suggestions", "replay_sync_settings", "replay_sync_runs", "replay_sync_quota", "replay_scan_cursors", "replay_issues"]) {
        await assert.rejects(pg.query(`SELECT * FROM ${table}`), /permission denied/);
      }
      await assert.rejects(pg.query("SELECT begin_replay_sync(true)"), /permission denied/);
      await assert.rejects(pg.query("SELECT review_replay_suggestion(gen_random_uuid(),true)"), /permission denied/);
      await pg.exec("RESET ROLE");
    }
    assert.equal((await pg.query<{ value: string | null }>("SELECT begin_replay_sync() value")).rows[0].value, null);
    // Service role sees the private tables but the cron stays disabled by default.
    await pg.exec("SET ROLE service_role");
    const candidateRows = (await pg.query<{ data: ReplayGame[] }>("SELECT replay_candidate_games() data")).rows[0].data;
    assert.equal(candidateRows.length, 2);
    assert.deepEqual(candidateRows.find(g => g.id === "pvl-game")?.start_time, gameSnapshot(candidateRows.find(g => g.id === "pvl-game")!).start_time);
    const published = new Date(Date.parse(candidateRows[0].start_time) + 4 * 3600000).toISOString();
    const apiCalls: string[] = [];
    let missing = false;
    const fetcher: typeof fetch = async input => {
      const url = new URL(String(input)); apiCalls.push(url.pathname);
      if (url.pathname.endsWith("/channels")) return Response.json({ items: [{ id: channel.channel_id, contentDetails: { relatedPlaylists: { uploads: "uploads" } } }] });
      if (url.pathname.endsWith("/playlistItems")) return Response.json({ items: ["abcdefghijk", "pbagame1234"].map(id => ({ contentDetails: { videoId: id, videoPublishedAt: published } })) });
      assert.ok(url.pathname.endsWith("/videos"));
      return Response.json({ items: missing ? [] : [
        { id: "abcdefghijk", title: "Creamline vs PLDT | PVL FULL GAME | 3-1" },
        { id: "pbagame1234", title: "San Miguel vs Ginebra | PBA Highlights | 100-98" },
      ].filter(v => url.searchParams.get("id")!.includes(v.id)).map(v => ({ id: v.id,
        snippet: { title: v.title, description: "Official replay", channelId: channel.channel_id, channelTitle: "Broadcaster", publishedAt: published, liveBroadcastContent: "none" },
        contentDetails: { duration: "PT1H30M" }, status: { privacyStatus: "public", embeddable: true, uploadStatus: "processed" } })) });
    };
    const client = replayTestClient(pg);
    const pausedRun = await runReplaySync({ db: client, fetcher });
    assert.ok("skipped" in pausedRun && pausedRun.skipped);
    assert.equal(apiCalls.length, 0);
    const run = await runReplaySync({ db: client, manual: true, fetcher });
    assert.ok("suggestions_created" in run);
    assert.equal(run.suggestions_created, 2);
    assert.equal(run.units_used, 3); // one shared channel fetched once, not once per game/league
    assert.equal(apiCalls.filter(p => p.endsWith("/playlistItems")).length, 1);
    assert.equal((await pg.query("SELECT id FROM games WHERE replay_url IS NOT NULL")).rows.length, 0);
    const suggestions = (await pg.query<{ id: string; game_id: string }>("SELECT id,game_id FROM replay_suggestions ORDER BY game_id")).rows;
    const pba = suggestions.find(s => s.game_id === "pba-game")!, pvl = suggestions.find(s => s.game_id === "pvl-game")!;
    await pg.query("SELECT review_replay_suggestion($1,false)", [pba.id]);
    const repeated = await runReplaySync({ db: client, manual: true, fetcher });
    assert.ok("suggestions_created" in repeated); assert.equal(repeated.suggestions_created, 0);
    assert.equal((await pg.query("SELECT id FROM replay_suggestions")).rows.length, 2);
    const retryLease = (await pg.query<{ id: string }>("SELECT begin_replay_sync(true) id")).rows[0].id;
    assert.equal((await pg.query<{ saved: boolean }>("SELECT store_replay_suggestion($1,(SELECT to_jsonb(r) FROM replay_suggestions r WHERE id=$2)) saved", [retryLease, pba.id])).rows[0].saved, false);
    await pg.query("SELECT finish_replay_sync($1,'success','{}')", [retryLease]);
    await pg.query(`INSERT INTO replay_suggestions(game_id,league,video_id,video_url,title,channel_id,channel_title,published_at,
      duration_seconds,kind,inferred_kind_reason,score,match_reasons,match_snapshot)
      SELECT game_id,league,'otherpvl123','https://www.youtube.com/watch?v=otherpvl123',title,channel_id,channel_title,published_at,
      duration_seconds,kind,inferred_kind_reason,score,match_reasons,match_snapshot FROM replay_suggestions WHERE id=$1`, [pvl.id]);
    await pg.query("SELECT review_replay_suggestion($1,true)", [pvl.id]);
    assert.equal((await pg.query("SELECT id FROM replay_suggestions WHERE status='superseded'")).rows.length, 1);
    const links = (await pg.query<{ watch_url: string; tickets_url: string; replay_url: string; replay_label: string }>("SELECT watch_url,tickets_url,replay_url,replay_label FROM games WHERE id='pvl-game'")).rows[0];
    assert.equal(links.watch_url, "https://watch.example/pvl"); assert.equal(links.tickets_url, "https://tickets.example/pvl");
    assert.equal(links.replay_url, "https://www.youtube.com/watch?v=abcdefghijk"); assert.equal(links.replay_label, channel.label);
    await assert.rejects(pg.query("SELECT review_replay_suggestion($1,true)", [pvl.id]), /already been reviewed/);
    // A manually saved replay must win even if review was opened earlier.
    await pg.exec("UPDATE replay_suggestions SET status='pending' WHERE game_id='pba-game'; UPDATE replay_channels SET enabled=false WHERE league='PBA'");
    await assert.rejects(pg.query("SELECT review_replay_suggestion($1,true)", [pba.id]), /no longer enabled/);
    await pg.exec("UPDATE replay_channels SET enabled=true WHERE league='PBA'; UPDATE games SET replay_url='https://youtu.be/manual12345',replay_kind='full' WHERE id='pba-game'");
    await assert.rejects(pg.query("SELECT review_replay_suggestion($1,true)", [pba.id]), /already has a replay/);
    // Weekly audit records an issue without erasing the published replay.
    missing = true;
    await pg.exec("UPDATE replay_sync_settings SET last_dead_check_at=now()-interval '8 days'");
    await runReplaySync({ db: client, manual: true, fetcher });
    assert.ok((await pg.query("SELECT * FROM replay_issues WHERE code='dead_link'")).rows.length);
    assert.equal((await pg.query<{ replay_url: string }>("SELECT replay_url FROM games WHERE id='pvl-game'")).rows[0].replay_url, links.replay_url);
    // Backfill includes older finals; normal scans do not. Approval also
    // rejects stale score snapshots, even if the URL is still empty.
    await pg.exec("UPDATE games SET replay_url=NULL,replay_kind=NULL,start_time=(now()-interval '60 days')::text WHERE id='pba-game'; UPDATE replay_suggestions SET status='rejected' WHERE game_id='pba-game'");
    assert.equal((await pg.query<{ data: ReplayGame[] }>("SELECT replay_candidate_games() data")).rows[0].data.length, 0);
    assert.equal((await pg.query<{ data: ReplayGame[] }>("SELECT replay_candidate_games('pba-test','PBA') data")).rows[0].data.length, 1);
    await pg.exec("UPDATE replay_suggestions SET status='pending' WHERE game_id='pba-game'");
    await assert.rejects(pg.query("SELECT review_replay_suggestion($1,true)", [pba.id]), /game changed/);
    const lease = (await pg.query<{ id: string }>("SELECT begin_replay_sync(true) id")).rows[0].id;
    assert.ok(lease);
    assert.equal((await pg.query<{ id: string | null }>("SELECT begin_replay_sync(true) id")).rows[0].id, null);
    await pg.exec("UPDATE replay_sync_quota SET units_used=2999 WHERE day=(now() AT TIME ZONE 'America/Los_Angeles')::date");
    assert.equal((await pg.query<{ ok: boolean }>("SELECT reserve_replay_unit($1) ok", [lease])).rows[0].ok, true);
    assert.equal((await pg.query<{ ok: boolean }>("SELECT reserve_replay_unit($1) ok", [lease])).rows[0].ok, false);
    await pg.query("SELECT finish_replay_sync($1,'success','{}')", [lease]);
    assert.equal((await pg.query<{ lease_id: string | null }>("SELECT lease_id FROM replay_sync_settings")).rows[0].lease_id, null);
  } finally {
    if (previousKey === undefined) delete process.env.YOUTUBE_API_KEY; else process.env.YOUTUBE_API_KEY = previousKey;
    await pg.close();
  }
});
