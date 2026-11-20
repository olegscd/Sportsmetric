import * as cheerio from "cheerio";

/**
 * Official PVL player statistics. Only per-conference counting stats are
 * stored (Supabase `pvl_player_conference_stats`); every average, success and
 * efficiency figure and the career line are derived here, so they can never
 * drift from the counts they come from.
 */

export interface PvlOfficialPlayerStatItem {
  playerSlug: string;
  playerName: string;
  team: string | null;
  position: string | null;
  jersey: number | null;
  height: string | null;
  school: string | null;
  statType: "career" | "conference";
  conferenceId: number | null;
  conferenceName: string | null;
  setsPlayed: number;
  totalPoints: number;
  avgPerSet: number;
  ptsAtk: number;
  ptsBlk: number;
  ptsAce: number;
  exeSet: number;
  exeDig: number;
  exeRec: number;
  faultAtk: number;
  faultBlk: number;
  faultSrv: number;
  faultSet: number;
  faultDig: number;
  faultRec: number;
  totalAtk: number;
  totalBlk: number;
  totalAce: number;
  totalSet: number;
  totalDig: number;
  totalRec: number;
  avgAtk: number;
  avgBlk: number;
  avgAce: number;
  avgSet: number;
  avgDig: number;
  avgRec: number;
  successAtk: number;
  successBlk: number;
  successAce: number;
  successSet: number;
  successDig: number;
  successRec: number;
  efficiencyAtk: number;
  efficiencyBlk: number;
  efficiencyAce: number;
  efficiencySet: number;
  efficiencyDig: number;
  efficiencyRec: number;
}

export interface PvlOfficialPlayerRecord {
  playerSlug: string;
  playerName: string;
  position: string | null;
  jersey: number | null;
  height: string | null;
  school: string | null;
  career: PvlOfficialPlayerStatItem | null;
  conferences: PvlOfficialPlayerStatItem[];
}

export const PVL_COUNT_FIELDS = [
  "setsPlayed", "ptsAtk", "ptsBlk", "ptsAce", "exeSet", "exeDig", "exeRec",
  "faultAtk", "faultBlk", "faultSrv", "faultSet", "faultDig", "faultRec",
  "totalAtk", "totalBlk", "totalAce", "totalSet", "totalDig", "totalRec",
] as const;
export type PvlCounts = Record<(typeof PVL_COUNT_FIELDS)[number], number>;

/** One stored row: a player's counting stats for one conference. */
export interface PvlConferenceStatRow {
  player_slug: string;
  conference_id: number;
  conference_name: string;
  player_name: string;
  team: string | null;
  position: string | null;
  jersey: number | null;
  height: string | null;
  school: string | null;
  stats: PvlCounts;
}

const SKILLS = [
  ["Atk", "ptsAtk", "faultAtk", "totalAtk"],
  ["Blk", "ptsBlk", "faultBlk", "totalBlk"],
  ["Ace", "ptsAce", "faultSrv", "totalAce"],
  ["Set", "exeSet", "faultSet", "totalSet"],
  ["Dig", "exeDig", "faultDig", "totalDig"],
  ["Rec", "exeRec", "faultRec", "totalRec"],
] as const;

const round2 = (n: number) => Math.round(n * 100) / 100;
const count = (value: unknown) => { const n = Number(value); return Number.isFinite(n) && n > 0 ? Math.round(n) : 0; };
export const pvlSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function emptyCounts(): PvlCounts {
  return Object.fromEntries(PVL_COUNT_FIELDS.map(f => [f, 0])) as PvlCounts;
}

export function normalizeCounts(input: Partial<Record<string, unknown>> | null | undefined): PvlCounts {
  const counts = emptyCounts();
  for (const f of PVL_COUNT_FIELDS) counts[f] = count(input?.[f]);
  return counts;
}

type Identity = Pick<PvlOfficialPlayerStatItem, "playerSlug" | "playerName" | "team" | "position" | "jersey" | "height" | "school" | "statType" | "conferenceId" | "conferenceName">;

/**
 * Points are attack + block + service points. Per-set figures divide by sets
 * played; success is points (or excellent sets/digs/receptions) per attempt;
 * efficiency subtracts faults first, as the PVL receivers table does.
 */
export function statItem(identity: Identity, counts: PvlCounts): PvlOfficialPlayerStatItem {
  const sets = counts.setsPlayed;
  const totalPoints = counts.ptsAtk + counts.ptsBlk + counts.ptsAce;
  const item = { ...identity, ...counts, totalPoints, avgPerSet: sets ? round2(totalPoints / sets) : 0 } as PvlOfficialPlayerStatItem;
  for (const [skill, good, fault, total] of SKILLS) {
    const attempts = counts[total];
    item[`avg${skill}`] = sets ? round2(counts[good] / sets) : 0;
    item[`success${skill}`] = attempts ? round2((counts[good] / attempts) * 100) : 0;
    item[`efficiency${skill}`] = attempts ? round2(((counts[good] - counts[fault]) / attempts) * 100) : 0;
  }
  return item;
}

/** Builds the profile record; the career line is the sum of every conference. */
export function recordFromRows(rows: readonly PvlConferenceStatRow[]): PvlOfficialPlayerRecord | null {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => b.conference_id - a.conference_id);
  const latest = sorted[0];
  const conferences = sorted.map(row => statItem({
    playerSlug: row.player_slug, playerName: row.player_name, team: row.team, position: row.position,
    jersey: row.jersey, height: row.height, school: row.school, statType: "conference",
    conferenceId: row.conference_id, conferenceName: row.conference_name,
  }, normalizeCounts(row.stats)));
  const totals = emptyCounts();
  for (const c of conferences) for (const f of PVL_COUNT_FIELDS) totals[f] += c[f];
  const identity = {
    playerSlug: latest.player_slug, playerName: latest.player_name,
    position: sorted.find(r => r.position)?.position ?? null, jersey: latest.jersey,
    height: sorted.find(r => r.height)?.height ?? null, school: sorted.find(r => r.school)?.school ?? null,
  };
  return {
    ...identity,
    career: statItem({ ...identity, team: null, statType: "career", conferenceId: null, conferenceName: null }, totals),
    conferences,
  };
}

/** Converts a record from the bundled legacy dataset into stored rows. */
export function rowsFromLegacyRecord(record: PvlOfficialPlayerRecord): PvlConferenceStatRow[] {
  return record.conferences.filter(c => c.conferenceId != null).map(c => ({
    player_slug: record.playerSlug, conference_id: Number(c.conferenceId), conference_name: c.conferenceName ?? "",
    player_name: c.playerName || record.playerName, team: c.team, position: c.position ?? record.position,
    jersey: c.jersey ?? record.jersey, height: c.height ?? record.height, school: c.school ?? record.school,
    stats: normalizeCounts(c as unknown as Record<string, unknown>),
  }));
}

const text = (value: unknown) => { const s = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""; return s || null; };

/**
 * Maps one `players/filter_by_careerstats_conference` response. Attempts are
 * the sum of the point/excellent, continue and fault columns.
 */
export function rowFromPlayerApi(slug: string, conferenceId: number, conferenceName: string, data: Record<string, unknown>): PvlConferenceStatRow | null {
  if (!data || typeof data !== "object" || data.slug !== slug || String(data.competitionId) !== String(conferenceId)) return null;
  const n = (key: string) => count(data[key]);
  const stats: PvlCounts = {
    setsPlayed: n("setsPlayed"),
    ptsAtk: n("AtkPoint"), ptsBlk: n("BlkPoint"), ptsAce: n("SrvPoint"),
    exeSet: n("SetExcel"), exeDig: n("DigExcel"), exeRec: n("RecExcel"),
    faultAtk: n("AtkFault"), faultBlk: n("BlkFault"), faultSrv: n("SrvFault"),
    faultSet: n("SetFault"), faultDig: n("DigFault"), faultRec: n("RecFault"),
    totalAtk: n("AtkPoint") + n("AtkCont") + n("AtkFault"),
    totalBlk: n("BlkPoint") + n("BlkCont") + n("BlkFault"),
    totalAce: n("SrvPoint") + n("SrvCont") + n("SrvFault"),
    totalSet: n("SetExcel") + n("SetCont") + n("SetFault"),
    totalDig: n("DigExcel") + n("DigCont") + n("DigFault"),
    totalRec: n("RecExcel") + n("RecCont") + n("RecFault"),
  };
  const jersey = Number(data.jersey_number);
  return {
    player_slug: slug, conference_id: conferenceId, conference_name: conferenceName,
    player_name: [text(data.firstName), text(data.lastName)].filter(Boolean).join(" ") || slug,
    team: text(data.teamName), position: text(data.position),
    jersey: Number.isInteger(jersey) && jersey > 0 ? jersey : null,
    height: text(data.height), school: text(data.school), stats,
  };
}

export interface PvlConferenceOption { id: number; name: string; selected: boolean }

/** Conference choices on pvl.ph/leaders; the selected one is in progress. */
export function parseLeaderConferences(html: string): PvlConferenceOption[] {
  const $ = cheerio.load(html);
  return $("#selectedConferenceId option").map((_, el) => ({
    id: Number($(el).attr("value")), name: $(el).text().replace(/\s+/g, " ").trim(), selected: $(el).is("[selected]"),
  })).get().filter(o => Number.isInteger(o.id) && o.id > 0 && o.name);
}

export interface PvlLeaderRow { slug: string; values: number[] }

/**
 * Reads a pvl.ph skill leader table: one row per player with the four
 * numeric columns. The scorers table (attack, block and service points, then
 * total) lists everyone who scored in the conference, which is how players
 * are discovered without a hand-kept list.
 */
export function parseLeaderTable(html: string): PvlLeaderRow[] {
  const $ = cheerio.load(html);
  const rows: PvlLeaderRow[] = [];
  const seen = new Set<string>();
  $("#stats tr").each((_, tr) => {
    const href = $(tr).find("a[href*='/players/']").first().attr("href") ?? "";
    const slug = href.match(/\/players\/([a-z0-9-]+)\/?$/i)?.[1]?.toLowerCase();
    const values = $(tr).children("td").slice(1).map((__, td) => Number($(td).text().replace(/[,%\s]/g, ""))).get();
    if (!slug || seen.has(slug) || values.length < 4 || values.some(v => !Number.isFinite(v))) return;
    seen.add(slug);
    rows.push({ slug, values });
  });
  return rows;
}

/**
 * Slugs that may identify a site player as an official PVL athlete: the
 * person id, the player id and any trailing part of it ("pvl-2026-cmf-kat-
 * tolentino" -> "kat-tolentino"), and the name.
 */
export function pvlSlugCandidates(personId: string, playerId: string, name?: string): string[] {
  const exact = [personId, playerId, name ?? ""].map(pvlSlug).filter(Boolean);
  const out = new Set<string>(exact);
  // Longest trailing parts first, so the most specific match wins.
  for (const slug of exact.slice(0, 2)) {
    const parts = slug.split("-");
    for (let i = 1; i <= parts.length - 2; i++) out.add(parts.slice(i).join("-"));
  }
  return [...out];
}
