import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { mockGames, mockPlayers, mockSeasons, mockTeams } from "../lib/mock-data";
import type { Game, Player, Season, Team } from "../types/sports";

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
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

function seasonToRecord(season: Season) {
  return {
    id: season.id,
    label: season.label,
    year: season.id,
    is_current: season.isCurrent,
  };
}

function teamToRecord(team: Team) {
  return {
    id: team.id,
    name: team.name,
    short_name: team.shortName,
    logo: team.logo,
    league: team.league,
    accent_color: team.accentColor,
    season_id: team.seasonId,
    record: team.record,
  };
}

function playerToRecord(player: Player) {
  return {
    id: player.id,
    person_id: player.personId,
    name: player.name,
    jersey_number: player.jerseyNumber,
    position: player.position,
    team_id: player.teamId,
    height: player.height,
    photo_url: player.photoUrl,
    season_id: player.seasonId,
    season_averages: player.seasonAverages,
    rank_badges: player.rankBadges,
  };
}

function gameToRecord(game: Game) {
  return {
    id: game.id,
    league: game.league,
    season_id: game.seasonId,
    home_team_id: game.homeTeam.id,
    away_team_id: game.awayTeam.id,
    home_score: game.homeScore,
    away_score: game.awayScore,
    status: game.status,
    start_time: game.startTime,
    quarter_or_set: game.quarterOrSet,
    time_remaining: game.timeRemaining,
    box_score: game.boxScore,
    play_by_play: game.playByPlay,
  };
}

async function main() {
  // Delete all rows first (order matters for FK constraints: games → players → teams → seasons)
  console.log("Clearing existing data...");

  const delGames = await supabase.from("games").delete().neq("id", "__impossible__");
  if (delGames.error) console.warn("Warning clearing games:", delGames.error.message);

  const delPlayers = await supabase.from("players").delete().neq("id", "__impossible__");
  if (delPlayers.error) console.warn("Warning clearing players:", delPlayers.error.message);

  const delTeams = await supabase.from("teams").delete().neq("id", "__impossible__");
  if (delTeams.error) console.warn("Warning clearing teams:", delTeams.error.message);

  const delSeasons = await supabase.from("seasons").delete().neq("id", "__impossible__");
  if (delSeasons.error) console.warn("Warning clearing seasons:", delSeasons.error.message);

  console.log("Cleared all existing rows.");

  // Insert fresh data (order: seasons → teams → players → games)
  const seasonsResult = await supabase.from("seasons").insert(mockSeasons.map(seasonToRecord));
  if (seasonsResult.error) {
    console.error("Failed seeding seasons:", seasonsResult.error.message);
    process.exit(1);
  }
  console.log(`Seeded seasons: ${mockSeasons.length} rows`);

  const teamsResult = await supabase.from("teams").insert(mockTeams.map(teamToRecord));
  if (teamsResult.error) {
    console.error("Failed seeding teams:", teamsResult.error.message);
    process.exit(1);
  }
  console.log(`Seeded teams: ${mockTeams.length} rows`);

  const playersResult = await supabase.from("players").insert(mockPlayers.map(playerToRecord));
  if (playersResult.error) {
    console.error("Failed seeding players:", playersResult.error.message);
    process.exit(1);
  }
  console.log(`Seeded players: ${mockPlayers.length} rows`);

  const gamesResult = await supabase.from("games").insert(mockGames.map(gameToRecord));
  if (gamesResult.error) {
    console.error("Failed seeding games:", gamesResult.error.message);
    process.exit(1);
  }
  console.log(`Seeded games: ${mockGames.length} rows`);

  console.log("Supabase seed complete.");
}

main();
