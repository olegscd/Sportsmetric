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

/**
 * Map official box rows onto the season roster with the same matching and
 * deterministic player ids as the admin importer, so automatic and manual
 * imports of the same game produce identical rows. Athletes not on the roster
 * are returned as new players (id `${teamId}-${name-slug}`); re-runs reuse them.
 */
export function resolveSyncBox(rows: ExtractedBoxRow[], teamId: string, league: League, players: SyncPlayer[]): { items: BoxScoreItem[]; created: NewSyncPlayer[] } {
  const roster = players.filter(p => p.team_id === teamId).map(p => ({ id: p.id, personId: p.person_id, name: p.name, jerseyNumber: p.jersey_number ?? 0 }) as Player);
  const created: NewSyncPlayer[] = [];
  const items = rows.map(row => {
    const personSlug = slug(row.playerName);
    let player = findBestPlayerMatch(row, roster) ?? roster.find(p => p.personId === personSlug);
    if (!player) {
      const fresh: NewSyncPlayer = {
        id: `${teamId}-${personSlug}`.slice(0, 200), person_id: personSlug, name: row.playerName,
        jersey_number: row.jersey ?? 0, position: league === "PVL" ? "OH" : "SG", team_id: teamId, season_averages: EMPTY_AVERAGES,
      };
      created.push(fresh);
      player = { id: fresh.id, personId: fresh.person_id, name: fresh.name, jerseyNumber: fresh.jersey_number } as Player;
      roster.push(player);
    }
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
