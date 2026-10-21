import type { ExtractedBoxRow } from "@/lib/game-extractor";
import { findBestPlayerMatch } from "@/lib/game-ingest-match";
import type { BoxScoreItem, League, Player } from "@/types/sports";

export interface SyncPlayer {
  id: string;
  person_id: string;
  name: string;
  jersey_number: number | null;
  team_id: string | null;
  season_id: string | null;
}

export interface NewSyncPlayer {
  id: string;
  person_id: string;
  name: string;
  jersey_number: number;
  position: string;
  team_id: string;
  season_averages: Record<string, number>;
}

const EMPTY_AVERAGES = { ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fgPct: 0, threePtPct: 0, ftPct: 0 };
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
function lastName(name: string): string {
  const parts = name.toLowerCase().replace(/[^a-z\s-]/g, " ").split(/[\s-]+/).filter(p => p && !SUFFIXES.has(p));
  return parts[parts.length - 1] ?? "";
}

/**
 * Map official box rows onto the season roster with the same matching and
 * deterministic player ids as the admin importer, so automatic and manual
 * imports of the same game produce identical rows. Athletes not on the roster
 * are returned as new players (id `${teamId}-${name-slug}`); re-runs reuse them.
 *
 * Each roster player is used at most once per box score: two athletes who
 * share a name (e.g. brothers) must never collapse into one player id.
 */
export function resolveSyncBox(rows: ExtractedBoxRow[], teamId: string, league: League, players: SyncPlayer[]): { items: BoxScoreItem[]; created: NewSyncPlayer[] } {
  const roster = players.filter(p => p.team_id === teamId).map(p => ({ id: p.id, personId: p.person_id, name: p.name, jerseyNumber: p.jersey_number ?? 0 }) as Player);
  const created: NewSyncPlayer[] = [];
  const used = new Set<string>();
  const assigned: (Player | undefined)[] = rows.map(() => undefined);
  const take = (i: number, p: Player | undefined) => { if (p) { assigned[i] = p; used.add(p.id); } };
  // 1. Same name and same jersey is the strongest evidence; settle those first.
  rows.forEach((row, i) => take(i, roster.find(p => !used.has(p.id) && row.jersey != null && p.jerseyNumber === row.jersey && norm(p.name) === norm(row.playerName))));
  // 2. The importer's matching among players not already in this box score.
  //    A jersey-only match must still agree on the last name.
  rows.forEach((row, i) => {
    if (assigned[i]) return;
    const free = roster.filter(p => !used.has(p.id));
    const p = findBestPlayerMatch(row, free) ?? free.find(p => p.personId === slug(row.playerName));
    const surname = lastName(row.playerName);
    if (p && (!surname || norm(p.name).includes(surname) || norm(row.playerName).includes(lastName(p.name)))) take(i, p);
  });
  // 3. Anyone left is new to the roster.
  rows.forEach((row, i) => {
    if (assigned[i]) return;
    const personSlug = slug(row.playerName);
    let id = `${teamId}-${personSlug}`.slice(0, 200);
    if (used.has(id) || roster.some(p => p.id === id && p.jerseyNumber !== (row.jersey ?? 0))) id = `${teamId}-${personSlug}-${row.jersey ?? i}`.slice(0, 200);
    const existing = roster.find(p => p.id === id);
    if (existing) { take(i, existing); return; }
    const fresh: NewSyncPlayer = {
      id, person_id: personSlug, name: row.playerName, jersey_number: row.jersey ?? 0,
      position: league === "PVL" ? "OH" : "SG", team_id: teamId, season_averages: EMPTY_AVERAGES,
    };
    created.push(fresh);
    const player = { id, personId: personSlug, name: row.playerName, jerseyNumber: fresh.jersey_number } as Player;
    roster.push(player);
    take(i, player);
  });
  const items = rows.map((row, i) => {
    const player = assigned[i]!;
    const item: BoxScoreItem = {
      playerId: player.id,
      jersey: row.jersey ?? (player.jerseyNumber > 0 ? player.jerseyNumber : undefined),
      playerName: player.name ?? row.playerName,
      pts: row.pts, reb: row.reb, ast: row.ast, stl: row.stl, blk: row.blk, to: row.to ?? 0, pf: row.pf ?? 0,
      fgM: row.fgM, fgA: row.fgA, threeM: row.threeM ?? 0, threeA: row.threeA ?? 0, ftM: row.ftM ?? 0, ftA: row.ftA ?? 0,
      min: row.min,
    };
    return item;
  });
  return { items, created };
}
