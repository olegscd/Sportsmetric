import { mapWithConcurrency } from "@/lib/game-sync/sources";
import {
  parseLeaderConferences, parseLeaderTable, rowFromPlayerApi,
  type PvlConferenceOption, type PvlConferenceStatRow,
} from "@/lib/pvl-player-stats";

/** Leader tables whose rows identify the players of a conference. */
export const PVL_LEADER_CATEGORIES = ["scorer", "digger", "setter", "receiver", "blocker", "server"] as const;

export interface PvlFetcher {
  /** GET a pvl.ph page. */
  get(url: string): Promise<string>;
  /** POST form fields to a pvl.ph endpoint. */
  post(url: string, form: Record<string, string>): Promise<string>;
}

export interface PvlConferenceStatsResult {
  conference: PvlConferenceOption;
  rows: PvlConferenceStatRow[];
  warnings: string[];
}

/**
 * Collects official stats for one conference (the one pvl.ph/leaders has
 * selected unless `conferenceId` is given). Players are discovered from the
 * skill leader tables, then each player's full line comes from the same
 * endpoint the player profile uses. The scorers table cross-checks every
 * line, so a changed source fails loudly instead of saving wrong numbers.
 */
export async function collectPvlConferenceStats(fetcher: PvlFetcher, conferenceId?: number, concurrency = 4): Promise<PvlConferenceStatsResult> {
  const options = parseLeaderConferences(await fetcher.get("https://pvl.ph/leaders"));
  if (!options.length) throw new Error("pvl.ph/leaders has no conference list; the page may have changed.");
  const conference = conferenceId ? options.find(o => o.id === conferenceId) : options.find(o => o.selected) ?? options[0];
  if (!conference) throw new Error(`Conference ${conferenceId} is not listed on pvl.ph/leaders.`);

  // The conference in progress is served by the leader pages themselves; its
  // filter endpoint only answers "stay tuned". Past conferences need the filter.
  const tables = await Promise.all(PVL_LEADER_CATEGORIES.map(async category => {
    const filtered = () => fetcher.post(`https://pvl.ph/${category}-conference-filter`, { competition_id: String(conference.id) });
    if (!conference.selected) return parseLeaderTable(await filtered());
    const rows = parseLeaderTable(await fetcher.get(`https://pvl.ph/leaders/${category}s`));
    return rows.length ? rows : parseLeaderTable(await filtered());
  }));
  const scorers = new Map(tables[0].map(r => [r.slug, r.values]));
  const slugs = [...new Set(tables.flat().map(r => r.slug))];
  if (!slugs.length) throw new Error(`No players are listed for ${conference.name}.`);

  const warnings: string[] = [];
  const results = await mapWithConcurrency(slugs, concurrency, async slug => {
    try {
      const body = await fetcher.post("https://pvl.ph/players/filter_by_careerstats_conference", { conferenceId: String(conference.id), playerslug: slug });
      const trimmed = body.trim();
      if (!trimmed || trimmed === "false") return null;
      const row = rowFromPlayerApi(slug, conference.id, conference.name, JSON.parse(trimmed));
      if (!row) { warnings.push(`${slug}: unexpected player response`); return null; }
      const listed = scorers.get(slug);
      if (listed && (listed[0] !== row.stats.ptsAtk || listed[1] !== row.stats.ptsBlk || listed[2] !== row.stats.ptsAce)) {
        warnings.push(`${slug}: player line disagrees with the scorers table`);
        return { row, mismatch: true };
      }
      return { row, mismatch: false };
    } catch (error) {
      warnings.push(`${slug}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  });
  const fetched = results.filter((r): r is { row: PvlConferenceStatRow; mismatch: boolean } => r !== null);
  const mismatches = fetched.filter(r => r.mismatch).length;
  // A few lines can move while a live conference updates; many cannot.
  if (fetched.length === 0 || mismatches > Math.max(3, fetched.length * 0.1)) {
    throw new Error(`Official PVL player lines do not match the leader tables (${mismatches} of ${fetched.length}); the source may have changed.`);
  }
  return { conference, rows: fetched.filter(r => !r.mismatch).map(r => r.row), warnings };
}
