/**
 * Imports the UAAP Season 89 U16 basketball results from the official
 * LiveStats tournament page, including the box scores that power player and
 * team statistics.
 *
 * The automatic updater only processes seasons flagged `is_current`, and UAAP
 * allows one current season per league (the men's tournament holds it), so U16
 * results are imported explicitly instead. Re-running is safe: existing games
 * keep their published scores and box scores, and only missing fixtures are
 * added.
 *
 * Run: npx tsx scripts/import-uaap-u16.ts [--dry-run]
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { parseBasketballGamePage, type ExtractedBoxRow } from "../lib/game-extractor";
import { buildGameId } from "../lib/game-id";
import { findBestPlayerMatch, findBestTeamMatch, normalizeStr } from "../lib/game-ingest-match";
import { fetchSource, parseBasketballGame, parseBasketballIndex } from "../lib/game-sync/sources";
import type { SyncSource } from "../lib/game-sync/types";
import { gameToRecord, playerToRecord } from "../lib/supabase-data";
import type { BoxScoreItem, Game, Player, Position, Team } from "../types/sports";

const SEASON_ID = "2026-27";
const TOURNAMENT_URL = "https://uaap.livestats.ph/tournaments/uaap-season-89-u16-basketball";
const DRY_RUN = process.argv.includes("--dry-run");

const SOURCE: SyncSource = {
  id: "uaap-s89-u16",
  league: "UAAP",
  season_id: SEASON_ID,
  label: "UAAP Season 89 U16 Basketball",
  tournament_url: TOURNAMENT_URL,
  year: 2026,
  starts_on: "2026-08-01",
  ends_on: "2027-06-30",
  conference_id: null,
  enabled: false,
};

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

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** The public LiveStats host rate-limits bursts, so retry transient 5xx replies. */
async function read(urlToFetch: string): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await fetchSource(urlToFetch);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!/HTTP 5\d\d/.test(message)) throw error;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function toTeam(row: {
  id: string;
  name: string;
  short_name: string;
  league: string;
  accent_color: string | null;
  logo: string | null;
  season_id: string;
  record: { wins: number; losses: number } | null;
}): Team {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    logo: row.logo,
    league: "UAAP",
    record: row.record ?? { wins: 0, losses: 0 },
    accentColor: row.accent_color ?? "#111827",
    seasonId: row.season_id,
  };
}

function toPlayer(row: {
  id: string;
  person_id: string | null;
  name: string;
  jersey_number: number;
  position: string;
  team_id: string;
  height: string;
  photo_url: string | null;
  season_averages: Player["seasonAverages"] | null;
  rank_badges: Player["rankBadges"] | null;
  season_id: string;
}): Player {
  return {
    id: row.id,
    personId: row.person_id ?? row.id,
    name: row.name,
    jerseyNumber: row.jersey_number,
    position: row.position as Position,
    teamId: row.team_id,
    height: row.height,
    photoUrl: row.photo_url,
    seasonAverages: row.season_averages ?? {
      ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fgPct: 0, threePtPct: 0, ftPct: 0,
    },
    rankBadges: row.rank_badges ?? [],
    seasonId: row.season_id,
  };
}

function playerSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function main() {
  const indexHtml = await read(TOURNAMENT_URL);
  const refs = parseBasketballIndex(indexHtml, TOURNAMENT_URL);

  const [teamsResult, playersResult, gamesResult] = await Promise.all([
    db.from("teams").select("*").eq("season_id", SEASON_ID),
    db.from("players").select("*").eq("season_id", SEASON_ID),
    db.from("games").select("*").eq("season_id", SEASON_ID),
  ]);
  for (const [label, result] of [["teams", teamsResult], ["players", playersResult], ["games", gamesResult]] as const) {
    if (result.error) throw new Error(`Could not load ${label}: ${result.error.message}`);
  }

  const teams = (teamsResult.data ?? []).map(toTeam);
  const roster = (playersResult.data ?? []).map(toPlayer);
  const existingGames = gamesResult.data ?? [];
  const gamesById = new Map(existingGames.map(game => [game.id as string, game]));
  const plannedPlayers = new Set<string>();

  const summary = {
    sourceGames: refs.length,
    inserted: 0,
    updatedMetadata: 0,
    unchanged: 0,
    skipped: 0,
    boxScoreRows: 0,
    playersCreated: 0,
    warnings: [] as string[],
  };

  const claimedIds = new Set<string>();

  for (const ref of refs) {
    try {
      const html = await read(ref.url);
      const obs = parseBasketballGame(html, ref, SOURCE);
      if (!obs.startTime) throw new Error("Official start time is missing.");
      const payload = parseBasketballGamePage(html, "UAAP", obs.stage, obs.status);

      // The index card and the detail page must describe the same game before
      // anything is written.
      if (payload.startTime !== obs.startTime) {
        throw new Error(`Detail time ${payload.startTime} disagrees with schedule ${obs.startTime}.`);
      }
      const flipped = normalizeStr(payload.homeTeam.shortName) === normalizeStr(obs.away) &&
        normalizeStr(payload.awayTeam.shortName) === normalizeStr(obs.home);
      if (!flipped && (normalizeStr(payload.homeTeam.shortName) !== normalizeStr(obs.home) ||
        normalizeStr(payload.awayTeam.shortName) !== normalizeStr(obs.away))) {
        throw new Error(`Detail teams ${payload.homeTeam.shortName}/${payload.awayTeam.shortName} disagree with schedule ${obs.home}/${obs.away}.`);
      }
      const detailHomeScore = flipped ? payload.awayTeam.score : payload.homeTeam.score;
      const detailAwayScore = flipped ? payload.homeTeam.score : payload.awayTeam.score;
      if (detailHomeScore !== obs.homeScore || detailAwayScore !== obs.awayScore) {
        throw new Error(`Detail score ${detailHomeScore}-${detailAwayScore} disagrees with schedule ${obs.homeScore}-${obs.awayScore}.`);
      }

      const home = findBestTeamMatch({ name: obs.home, shortName: obs.home }, teams);
      const away = findBestTeamMatch({ name: obs.away, shortName: obs.away }, teams);
      if (!home || !away || home.id === away.id) {
        throw new Error(`Could not resolve teams ${obs.home} vs ${obs.away} in season ${SEASON_ID}.`);
      }

      const id = buildGameId({
        league: "UAAP",
        seasonId: SEASON_ID,
        homeShort: home.shortName,
        awayShort: away.shortName,
        startTimeIso: obs.startTime,
        claimedIds,
      });
      claimedIds.add(id);

      const existing = gamesById.get(id) ??
        existingGames.find(game =>
          game.home_team_id === home.id && game.away_team_id === away.id &&
          String(game.start_time).slice(0, 10) === obs.startTime!.slice(0, 10));

      const homeRows = flipped ? payload.boxScore.away : payload.boxScore.home;
      const awayRows = flipped ? payload.boxScore.home : payload.boxScore.away;

      if (existing) {
        if (existing.home_score !== obs.homeScore || existing.away_score !== obs.awayScore) {
          summary.warnings.push(`${ref.key} ${id}: stored score ${existing.home_score}-${existing.away_score} differs from the official ${obs.homeScore}-${obs.awayScore}; left unchanged.`);
          summary.skipped++;
          continue;
        }
        const changes: Record<string, unknown> = {};
        if (new Date(existing.start_time).toISOString() !== obs.startTime) changes.start_time = obs.startTime;
        if (!existing.venue && obs.venue) changes.venue = obs.venue;
        if (!existing.stage) changes.stage = obs.stage;
        if (existing.is_playoff === null) changes.is_playoff = false;
        if (Object.keys(changes).length === 0) {
          summary.unchanged++;
          continue;
        }
        if (!DRY_RUN) {
          const { error } = await db.from("games").update(changes).eq("id", existing.id as string);
          if (error) throw new Error(`Could not update ${id}: ${error.message}`);
        }
        summary.updatedMetadata++;
        console.log(`${DRY_RUN ? "would update" : "updated"}  ${obs.day}  ${home.shortName} vs ${away.shortName}: ${Object.keys(changes).join(", ")}`);
        continue;
      }

      const homeBox = await resolveBoxRows(homeRows, home, roster, summary, plannedPlayers);
      const awayBox = await resolveBoxRows(awayRows, away, roster, summary, plannedPlayers);
      summary.boxScoreRows += homeBox.length + awayBox.length;
      if (!homeBox.length || !awayBox.length) {
        summary.warnings.push(`${ref.key} ${id}: official box score is missing one side.`);
      }

      const game: Game = {
        id,
        league: "UAAP",
        seasonId: SEASON_ID,
        homeTeam: home,
        awayTeam: away,
        homeScore: obs.homeScore!,
        awayScore: obs.awayScore!,
        status: "FINAL",
        quarterOrSet: 4,
        timeRemaining: null,
        startTime: obs.startTime,
        venue: obs.venue,
        stage: obs.stage,
        isPlayoff: false,
        boxScore: { home: homeBox, away: awayBox },
        playByPlay: [],
      };

      if (!DRY_RUN) {
        const { error } = await db.from("games").upsert([gameToRecord(game)]);
        if (error) throw new Error(`Could not save ${id}: ${error.message}`);
      }
      summary.inserted++;
      console.log(`${DRY_RUN ? "would add" : "added"}  ${obs.day}  ${home.shortName} ${obs.homeScore}-${obs.awayScore} ${away.shortName}  (${homeBox.length}+${awayBox.length} box rows)`);
      await sleep(400);
    } catch (error) {
      summary.skipped++;
      const message = error instanceof Error ? error.message : String(error);
      summary.warnings.push(`${ref.key}: ${message}`);
    }
  }

  console.log(`\n${DRY_RUN ? "DRY RUN — no writes were made" : "Import complete"}`);
  console.log(`Source matches: ${summary.sourceGames}`);
  console.log(`New games: ${summary.inserted}`);
  console.log(`Existing games with corrected details: ${summary.updatedMetadata}`);
  console.log(`Already up to date: ${summary.unchanged}`);
  console.log(`Skipped: ${summary.skipped}`);
  console.log(`Box score rows: ${summary.boxScoreRows}`);
  console.log(`Players ${DRY_RUN ? "that would be created" : "created"}: ${summary.playersCreated}`);
  if (summary.warnings.length) {
    console.log(`\nWarnings (${summary.warnings.length}):`);
    for (const warning of summary.warnings) console.log("- " + warning);
  }
  if (summary.skipped > 0) process.exitCode = 1;
}

async function resolveBoxRows(
  rows: ExtractedBoxRow[],
  team: Team,
  roster: Player[],
  summary: { warnings: string[]; playersCreated: number },
  plannedPlayers: Set<string>,
): Promise<BoxScoreItem[]> {
  const result: BoxScoreItem[] = [];
  const teamRoster = roster.filter(player => player.teamId === team.id);

  for (const row of rows) {
    let matched = findBestPlayerMatch(row, teamRoster) ??
      teamRoster.find(player => player.personId === playerSlug(row.playerName));

    if (!matched) {
      const created = await createPlayer(row, team, summary, plannedPlayers);
      if (created) {
        // Keep the new player in the shared roster so later games in this run
        // match them instead of trying to create them again.
        roster.push(created);
        teamRoster.push(created);
        matched = created;
      }
    }

    if (!matched) {
      summary.warnings.push(`${team.shortName}: could not match box score row for ${row.playerName}.`);
      continue;
    }

    result.push({
      playerId: matched.id,
      jersey: row.jersey ?? (matched.jerseyNumber > 0 ? matched.jerseyNumber : undefined),
      playerName: matched.name,
      pts: row.pts,
      reb: row.reb,
      ast: row.ast,
      stl: row.stl,
      blk: row.blk,
      to: row.to ?? 0,
      pf: row.pf ?? 0,
      fgM: row.fgM,
      fgA: row.fgA,
      threeM: row.threeM ?? 0,
      threeA: row.threeA ?? 0,
      ftM: row.ftM ?? 0,
      ftA: row.ftA ?? 0,
      min: row.min,
    });
  }

  return result;
}

async function createPlayer(
  row: ExtractedBoxRow,
  team: Team,
  summary: { warnings: string[]; playersCreated: number },
  plannedPlayers: Set<string>,
): Promise<Player | null> {
  const slug = playerSlug(row.playerName);
  const id = `${team.id}-${slug}`.slice(0, 200);
  if (plannedPlayers.has(id)) return null;
  plannedPlayers.add(id);

  const player: Player = {
    id,
    personId: slug,
    name: row.playerName,
    jerseyNumber: row.jersey ?? 0,
    position: "SG",
    teamId: team.id,
    height: "",
    photoUrl: null,
    seasonId: team.seasonId,
    seasonAverages: { ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fgPct: 0, threePtPct: 0, ftPct: 0 },
    rankBadges: [],
  };

  if (DRY_RUN) {
    summary.playersCreated++;
    return player;
  }

  const { error } = await db.from("players").upsert([playerToRecord(player)]);
  if (error) {
    summary.warnings.push(`Could not create player ${row.playerName} (${team.shortName}): ${error.message}`);
    plannedPlayers.delete(id);
    return null;
  }
  summary.playersCreated++;
  return player;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
