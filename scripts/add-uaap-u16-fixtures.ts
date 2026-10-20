/**
 * Adds the announced UAAP Season 89 U16 basketball fixtures for 24-25 October
 * 2026, which are not yet listed on the LiveStats results page. Insert-only:
 * existing games are never overwritten, so re-running is safe.
 *
 * Run: npx tsx scripts/add-uaap-u16-fixtures.ts
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { buildGameId } from "../lib/game-id";

const SEASON_ID = "2026-27";

// Times are Philippine time (UTC+8) converted to UTC.
const FIXTURES = [
  { home: "ateneo-2026-27", away: "ust-2026-27", homeShort: "admu", awayShort: "ust", startTime: "2026-10-24T00:00:00.000Z", venue: "Blue Eagle Gym" },
  { home: "dlsu-2026-27", away: "ue-2026-27", homeShort: "dlsu", awayShort: "ue", startTime: "2026-10-25T00:00:00.000Z", venue: "Blue Eagle Gym" },
] as const;

// Load .env.local for CLI usage (Next.js loads this automatically in dev/build).
const envPath = path.resolve(".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, key);

const claimedIds = new Set<string>();
const rows = FIXTURES.map(fixture => {
  const id = buildGameId({
    league: "UAAP",
    seasonId: SEASON_ID,
    homeShort: fixture.homeShort,
    awayShort: fixture.awayShort,
    startTimeIso: fixture.startTime,
    claimedIds,
  });
  claimedIds.add(id);
  return {
    id,
    league: "UAAP",
    season_id: SEASON_ID,
    home_team_id: fixture.home,
    away_team_id: fixture.away,
    home_score: 0,
    away_score: 0,
    status: "UPCOMING",
    start_time: fixture.startTime,
    quarter_or_set: 0,
    time_remaining: null,
    venue: fixture.venue,
    stage: "ELIMINATION",
    is_playoff: false,
  };
});

async function main() {
  const { data: existing, error: readError } = await supabase
    .from("games")
    .select("id")
    .in("id", rows.map(row => row.id));

  if (readError) {
    console.error(readError.message);
    process.exit(1);
  }

  const present = new Set((existing ?? []).map(row => row.id));
  const missing = rows.filter(row => !present.has(row.id));

  if (!missing.length) {
    console.log("Both U16 fixtures are already present; nothing inserted.");
    return;
  }

  const { error } = await supabase.from("games").insert(missing);
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  for (const row of missing) {
    console.log(`${row.start_time}  ${row.id}  ${row.venue}`);
  }
  console.log(`Inserted ${missing.length} U16 fixture${missing.length === 1 ? "" : "s"}.`);
}

main();
