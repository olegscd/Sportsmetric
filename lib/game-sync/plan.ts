import { createHash } from "node:crypto";
import type { League, TournamentStage } from "@/types/sports";
import type { Observation, StoredGame, SyncDecision, SyncLink, SyncSource, SyncTeam } from "./types";

const normalize = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases: Record<League, string[][]> = {
  UAAP: [["LA SALLE", "DLSU", "DLSU Green Archers"], ["ATENEO", "ADMU", "Ateneo Blue Eagles"], ["ADU", "Adamson", "Adamson Soaring Falcons"]],
  PBA: [
    ["BWB", "BLK", "Blackwater Bossing"], ["CON", "CFX", "Converge FiberXers"],
    ["GIN", "Barangay Ginebra San Miguel"], ["MAG", "Magnolia Chicken Timplados Hotshots", "Magnolia Hotshots"],
    ["MER", "Meralco Bolts"], ["NLX", "NLEX", "NLEX Road Warriors"],
    ["PHX", "Phoenix", "Phoenix Fuel Masters", "Phoenix Super LPG Fuel Masters"],
    ["ROS", "Rain or Shine Elasto Painters"], ["SMB", "San Miguel Beermen"],
    ["TER", "TERRA", "Terrafirma Dyip"], ["TGR", "TITAN", "Titan Ultra Giant Risers"],
    ["TNT", "TNT Tropang 5G"], ["MGP", "MBK", "Macau Giant Pandas", "Macau Black Bears"],
  ],
  PVL: [
    ["CCS", "CREAM", "Creamline Cool Smashers"], ["HSH", "PLDT", "PLDT High Speed Hitters"],
    ["AKA", "AKARI", "Akari Power Chargers", "Akari Chargers"], ["CAP", "CAP1", "Capital1 Solar Spikers"],
    ["CMF", "Choco Mucho Flying Titans"], ["FFF", "Farm Fresh Foxies"],
    ["GTH", "Galeries Tower Highrisers"], ["NXL", "Nxled Chameleons"], ["ZUS", "Zus Coffee Thunderbelles"],
  ],
};

export function matchTeam(value: string, teams: SyncTeam[], league: League): SyncTeam | null {
  const token = normalize(value);
  const group = aliases[league].find(g => g.some(a => normalize(a) === token));
  const accepted = new Set([token, ...(group ?? []).map(normalize)]);
  const matches = teams.filter(t => t.league === league && (accepted.has(normalize(t.short_name)) || accepted.has(normalize(t.name))));
  return matches.length === 1 ? matches[0] : null;
}

export function philippineDay(time: string): string {
  return new Date(Date.parse(time) + 8 * 3600000).toISOString().slice(0, 10);
}

export function stageFromText(text: string): TournamentStage {
  if (/semi.?final/i.test(text)) return "SEMIFINALS";
  if (/championship|\bfinals?\b|runner.up/i.test(text)) return "FINALS";
  if (/play.?in|quarter.?final/i.test(text)) return "PLAY_IN";
  return "ELIMINATION";
}

export function sameSnapshot(game: StoredGame, snapshot: Partial<StoredGame>): boolean {
  return Object.entries(snapshot).every(([key, value]) => {
    if (key === "start_time") return Date.parse(game.start_time) === Date.parse(String(value));
    return game[key as keyof StoredGame] === value;
  });
}

/** Period/clock fields for the stored game. Finals keep the last period played. */
export function livePeriod(source: SyncSource, item: Observation): Pick<StoredGame, "quarter_or_set" | "time_remaining"> {
  if (item.status === "LIVE") return { quarter_or_set: item.period ?? null, time_remaining: item.period ? item.clock ?? null : null };
  if (item.status === "FINAL") {
    const period = source.league === "PVL" ? (item.homeScore ?? 0) + (item.awayScore ?? 0) : Math.max(4, item.period ?? 4);
    return { quarter_or_set: period, time_remaining: null };
  }
  return {};
}

export function planObservation(source: SyncSource, item: Observation, teams: SyncTeam[], games: StoredGame[], links: SyncLink[], siblings: Observation[] = []): SyncDecision {
  if (item.day < source.starts_on || item.day > source.ends_on) return { kind: "review", reason: "Source date falls outside the configured competition." };
  if (item.startTime && (!Number.isFinite(Date.parse(item.startTime)) || philippineDay(item.startTime) !== item.day)) {
    return { kind: "review", reason: "Source date and start time disagree." };
  }
  const home = matchTeam(item.home, teams, source.league);
  const away = matchTeam(item.away, teams, source.league);
  if (!home || !away || home.id === away.id) return { kind: "review", reason: "Teams could not be matched uniquely. Check team names and aliases." };
  if (home.season_id !== source.season_id || away.season_id !== source.season_id) return { kind: "review", reason: "Team belongs to another season." };
  if (item.status === "LIVE") {
    const scores = [item.homeScore, item.awayScore];
    if (!scores.every(n => Number.isInteger(n) && n !== null && n >= 0)) return { kind: "review", reason: "Live scores are missing or invalid." };
    if (Math.max(...scores as number[]) > (source.league === "PVL" ? 3 : 250)) return { kind: "review", reason: "Live score needs review." };
  }
  if (item.status === "FINAL") {
    const scores = [item.homeScore, item.awayScore];
    if (!scores.every(n => Number.isInteger(n) && n !== null && n >= 0) || item.homeScore === item.awayScore) {
      return { kind: "review", reason: "Final scores are missing, tied, or invalid." };
    }
    if (source.league === "PVL" && (Math.max(...scores as number[]) !== 3 || Math.min(...scores as number[]) > 2)) {
      return { kind: "review", reason: "Volleyball final result is not a valid best-of-five score." };
    }
    if (source.league !== "PVL" && Math.max(...scores as number[]) > 250) return { kind: "review", reason: "Basketball score needs review." };
  }
  const link = links.find(l => l.source_id === source.id && l.source_key === item.key);
  if (link?.paused) return { kind: "skip", reason: "Automatic updates are paused for this game." };
  const relevant = games.filter(g => g.league === source.league && g.season_id === source.season_id);
  const pair = relevant.filter(g => [g.home_team_id, g.away_team_id].includes(home.id) && [g.home_team_id, g.away_team_id].includes(away.id));
  let previous = link ? relevant.find(g => g.id === link.game_id) ?? null : null;
  if (link && !previous) return { kind: "review", reason: "Linked fixture was deleted. It will not be recreated automatically." };
  if (!previous) {
    const deleted = links.some(l => l.source_id === source.id && l.snapshot && !relevant.some(g => g.id === l.game_id) &&
      [l.snapshot.home_team_id, l.snapshot.away_team_id].includes(home.id) && [l.snapshot.home_team_id, l.snapshot.away_team_id].includes(away.id));
    if (deleted) return { kind: "review", reason: "A matching fixture was deleted manually. Review before recreating it." };
    const dated = pair.filter(g => philippineDay(g.start_time) === item.day);
    if (dated.length > 1) return { kind: "review", reason: "Multiple fixtures match this pairing and date." };
    previous = dated[0] ?? null;
    if (!previous) {
      // Date-less official fixture IDs are common. Only move a unique unfinished
      // pairing within a week, and never merge repeat playoff meetings.
      const possible = pair.filter(g => g.status !== "FINAL" && (g.stage ?? "ELIMINATION") === item.stage);
      if (possible.length) {
        const repeated = siblings.some(other => other.key !== item.key && other.day !== item.day &&
          [matchTeam(other.home, teams, source.league)?.id, matchTeam(other.away, teams, source.league)?.id].includes(home.id) &&
          [matchTeam(other.home, teams, source.league)?.id, matchTeam(other.away, teams, source.league)?.id].includes(away.id));
        if (repeated) return { kind: "review", reason: "The source lists repeat meetings; a date change cannot be matched automatically." };
        if (possible.length !== 1 || item.stage !== "ELIMINATION" || Math.abs(Date.parse(possible[0].start_time) - Date.parse(item.day)) > 7 * 86400000) {
          return { kind: "review", reason: "Possible reschedule is ambiguous; review the existing fixtures." };
        }
        previous = possible[0];
      }
    }
  }
  if (previous && links.some(l => l.game_id === previous!.id && l.paused)) return { kind: "skip", reason: "Automatic updates are paused for this game." };
  if (previous && (previous.home_team_id !== home.id && previous.away_team_id !== home.id || previous.home_team_id !== away.id && previous.away_team_id !== away.id)) {
    return { kind: "review", gameId: previous.id, reason: "The source changed the teams of a linked fixture." };
  }
  // A fixture usually has several source aliases (schedule entry, live/result
  // entry). Only a snapshot that matches none of the current values signals a
  // manual edit; an alias that simply has not been refreshed yet does not.
  const snapshots = previous ? links.filter(l => l.game_id === previous!.id && l.snapshot) : [];
  if (previous && snapshots.length && !snapshots.some(l => sameSnapshot(previous!, l.snapshot!))) {
    return { kind: "review", gameId: previous.id, reason: "This fixture was edited manually. Automatic changes are held for review." };
  }
  // A schedule listing never takes a game that is already in progress back to upcoming.
  if (previous?.status === "LIVE" && item.status === "UPCOMING") return { kind: "skip", reason: "Game is already live." };
  if (!previous && !item.startTime) return { kind: "review", reason: "Result has no confirmed start time and no matching scheduled fixture." };
  const reversed = previous?.home_team_id === away.id;
  const scored = item.status !== "UPCOMING";
  const game: StoredGame = {
    id: previous?.id ?? "sync-" + createHash("sha256").update(source.id + ":" + item.key).digest("hex").slice(0, 24),
    league: source.league, season_id: source.season_id,
    home_team_id: previous?.home_team_id ?? home.id, away_team_id: previous?.away_team_id ?? away.id,
    home_score: scored ? (reversed ? item.awayScore! : item.homeScore!) : previous?.home_score ?? 0,
    away_score: scored ? (reversed ? item.homeScore! : item.awayScore!) : previous?.away_score ?? 0,
    status: item.status, start_time: item.startTime ?? previous!.start_time,
    venue: item.venue || previous?.venue || null,
    stage: previous?.stage ?? item.stage, is_playoff: previous?.is_playoff ?? item.stage !== "ELIMINATION",
    ...livePeriod(source, item),
  };
  if (previous?.status === "FINAL") {
    if (item.status !== "FINAL") return { kind: "skip", reason: "A final result cannot revert." };
    if (previous.home_score !== game.home_score || previous.away_score !== game.away_score) return { kind: "review", gameId: previous.id, reason: "Official scores differ from a published final. Review the correction." };
    // Link existing correct results without altering previously reviewed metadata.
    return { kind: "save", game: previous, previous };
  }
  return { kind: "save", game, previous };
}
