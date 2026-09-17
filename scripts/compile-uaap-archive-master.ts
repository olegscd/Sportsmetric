/**
 * Compiles every transcribed UAAP annual report into one digital book, then
 * extracts team standings into:
 *   - paste-ready TSV blocks for Admin → UAAP Archive → Bulk import
 *   - a CSV / Excel masterfile of all sports and seasons
 *
 * Run: npx tsx scripts/compile-uaap-archive-master.ts
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { getSchoolName, matchSchoolCode } from "../lib/uaap-schools";
import {
  applyImport,
  detectColumnPreset,
  extractAwardsFromText,
  guessTargets,
  parseMarkdownTables,
  parsePlacementLabel,
  parsePlacementLines,
  scoreStandingsGrid,
  sliceReportForDivision,
  type ExtractedAwards,
  type ParsedGrid,
} from "../lib/uaap-import";
import { COLUMN_PRESETS, normalizeDivision, type UAAPColumn, type UAAPRow } from "../lib/uaap-schema";

const ROOT = path.resolve(__dirname, "..");
const SEASONS_DIR = path.join(ROOT, "data", "seasons");
const OUT_DIR = path.join(ROOT, "data", "compiled");
const PASTE_DIR = path.join(OUT_DIR, "paste");

const SEASONS = [
  "1987-1988",
  "1988-1989",
  "1989-1990",
  "1998-1999",
  "1999-2000",
  "2000-2001",
  "2003-2004",
];

const SPORTS: Array<{ name: string; pattern: RegExp }> = [
  { name: "General Championship", pattern: /general championship|over-?all team standings|overall standings|over all team/i },
  { name: "Table Tennis", pattern: /table\s*tennis/i },
  { name: "Tae Kwon Do", pattern: /tae[\s-]*kwon[\s-]*do|taekwondo/i },
  { name: "Lawn Tennis", pattern: /lawn\s*tennis|\btennis\b/i },
  { name: "Basketball", pattern: /\bbasketball\b/i },
  { name: "Volleyball", pattern: /\bvolleyball\b/i },
  { name: "Badminton", pattern: /\bbadminton\b/i },
  { name: "Baseball", pattern: /\bbaseball\b/i },
  { name: "Softball", pattern: /\bsoftball\b/i },
  { name: "Football", pattern: /\bfootball\b|\bsoccer\b/i },
  { name: "Fencing", pattern: /\bfencing\b/i },
  { name: "Chess", pattern: /\bchess\b/i },
  { name: "Judo", pattern: /\bjudo\b/i },
  { name: "Swimming", pattern: /\bswimming\b/i },
  { name: "Track and Field", pattern: /track\s*(and|&)\s*field/i },
];

interface StandingRow {
  season: string;
  sport: string;
  division: string;
  stage: string;
  rank: number;
  team: string;
  team_name: string;
  wins: number | null;
  losses: number | null;
  points: number | null;
  details: string | null;
  mvp: string | null;
  rookie: string | null;
  source: string;
}

interface DivisionExtract {
  season: string;
  sport: string;
  division: string;
  paste: string;
  rows: StandingRow[];
  awards: ExtractedAwards;
  source: string;
}

function slug(value: string): string {
  return value
    .replace(/[']/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function findSeasonBook(season: string): string | null {
  const dir = path.join(SEASONS_DIR, season);
  if (!fs.existsSync(dir)) return null;
  const match = fs.readdirSync(dir).find((f) => f.endsWith(".md") && !f.startsWith("IMG_"));
  return match ? path.join(dir, match) : null;
}

function inferSport(text: string): string | null {
  const window = text.slice(0, 1200);
  for (const sport of SPORTS) {
    if (sport.pattern.test(window) || sport.pattern.test(text.slice(0, 4000))) {
      return sport.name;
    }
  }
  return null;
}

function splitPages(markdown: string): Array<{ id: string; text: string }> {
  const parts = markdown.split(/<!--\s*START PAGE[^\n]*-->/i);
  if (parts.length <= 1) return [{ id: "book", text: markdown }];
  const ids = [...markdown.matchAll(/<!--\s*START PAGE[^\n]*?\(([^)]+)\)[^\n]*-->/gi)].map(
    (m) => m[1].replace(/\.md$/i, "")
  );
  return parts.slice(1).map((text, i) => ({
    id: ids[i] || `page-${i + 1}`,
    text,
  }));
}

function looksLikeGameResults(text: string): boolean {
  const upper = text.toUpperCase();
  if (!upper.includes("DEFEATED") && !upper.includes("FIRST ROUND RESULTS")) return false;
  return !/FINAL STANDING/.test(upper);
}

function looksLikePlayerStatsPage(text: string): boolean {
  if (/FINAL STANDING|WIN\s*[-–]\s*LOSS|TEAM STANDING|TOTAL POINTS/i.test(text)) return false;
  const upper = text.toUpperCase();
  return (
    upper.includes("M/A") ||
    /PLAYER STATISTICS|SCORING AVERAGE/.test(upper)
  );
}

function isTeamStandingsGrid(grid: ParsedGrid): boolean {
  if (scoreStandingsGrid(grid) < 8) return false;
  const header = (grid.headers ?? []).join(" ").toLowerCase();
  if (/\bbb m\b|\bbb w\b|\bvb m\b/.test(header)) return false;

  const parsed = rowsFromGrid(grid);
  const schoolRows = parsed.filter((row) => matchSchoolCode(row.team));
  if (schoolRows.length < 3 || schoolRows.length > 12) return false;
  if (parsed.length > 12 && schoolRows.length < parsed.length * 0.6) return false;

  const wins = schoolRows.map((row) => num(row.values.wins)).filter((n): n is number => n !== null);
  if (wins.length >= 3 && wins.filter((w) => w > 18).length >= 3) return false;
  return true;
}

function columnsForGrid(grid: ParsedGrid): UAAPColumn[] {
  const preset = detectColumnPreset(grid.headers);
  if (preset) return preset.columns.map((c) => ({ ...c }));
  const placement =
    grid.rows.length > 0 && grid.rows.every((row) => row.some((cell) => parsePlacementLabel(cell)));
  if (placement) return COLUMN_PRESETS.find((p) => p.id === "placement")?.columns ?? [];
  return COLUMN_PRESETS[0].columns.map((c) => ({ ...c }));
}

function rowsFromGrid(grid: ParsedGrid): UAAPRow[] {
  const columns = columnsForGrid(grid);
  return applyImport(grid, guessTargets(grid, columns), columns);
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(n) ? n : null;
}

function toStandingRows(
  season: string,
  sport: string,
  division: string,
  uaapRows: UAAPRow[],
  source: string,
  awards: ExtractedAwards,
  stage = "Final Standings"
): StandingRow[] {
  return uaapRows
    .filter((row) => (row.team || "").trim() !== "")
    .map((row, idx) => {
      const code = matchSchoolCode(row.team) || row.team.trim();
      return {
        season,
        sport,
        division: normalizeDivision(division),
        stage,
        rank: row.rank || idx + 1,
        team: code,
        team_name: getSchoolName(code) || code,
        wins: num(row.values.wins),
        losses: num(row.values.losses),
        points: num(row.values.points),
        details: row.details,
        mvp: awards.mvp ? `${awards.mvp.player} (${awards.mvp.school})` : null,
        rookie: awards.rookie_of_the_year
          ? `${awards.rookie_of_the_year.player} (${awards.rookie_of_the_year.school})`
          : null,
        source,
      };
    });
}

function mergeDivisionRows(rows: StandingRow[]): StandingRow[] {
  const byTeam = new Map<string, StandingRow>();
  const sorted = [...rows].sort((a, b) => {
    const aPlace = a.details && parsePlacementLabel(a.details) ? 4 : 0;
    const aScore = aPlace + (a.wins !== null ? 2 : 0) + (a.points !== null ? 1 : 0);
    const bPlace = b.details && parsePlacementLabel(b.details) ? 4 : 0;
    const bScore = bPlace + (b.wins !== null ? 2 : 0) + (b.points !== null ? 1 : 0);
    return bScore - aScore;
  });
  for (const row of sorted) {
    const key = row.team.toUpperCase();
    const existing = byTeam.get(key);
    if (!existing) {
      byTeam.set(key, { ...row });
      continue;
    }
    if (existing.wins === null && row.wins !== null) existing.wins = row.wins;
    if (existing.losses === null && row.losses !== null) existing.losses = row.losses;
    if (existing.points === null && row.points !== null) existing.points = row.points;
    if (!existing.details && row.details) existing.details = row.details;
    const placed = row.details ? parsePlacementLabel(row.details) : null;
    if (placed) existing.rank = placed.rank;
    else if (!existing.details && row.rank > 0 && row.rank < existing.rank) existing.rank = row.rank;
  }
  return Array.from(byTeam.values())
    .map((row) => {
      const placed = row.details ? parsePlacementLabel(row.details) : null;
      return placed ? { ...row, rank: placed.rank } : row;
    })
    .sort((a, b) => a.rank - b.rank || (b.wins ?? -1) - (a.wins ?? -1) || a.team.localeCompare(b.team));
}

function pasteFromRows(rows: StandingRow[]): string {
  const hasWL = rows.some((r) => r.wins !== null || r.losses !== null);
  let hasPts = rows.some((r) => r.points !== null);
  const sport = rows[0]?.sport;
  if (
    hasPts &&
    hasWL &&
    (sport === "Basketball" || sport === "Volleyball") &&
    rows.every((r) => r.points === null || r.points <= 20)
  ) {
    hasPts = false;
  }
  const header = ["Rank", "School"];
  if (hasWL) header.push("W", "L");
  if (hasPts) header.push("PTS");
  header.push("Notes");
  const lines = [header.join("\t")];
  for (const row of rows) {
    const cells = [String(row.rank), row.team];
    if (hasWL) cells.push(row.wins === null ? "" : String(row.wins), row.losses === null ? "" : String(row.losses));
    if (hasPts) cells.push(row.points === null ? "" : String(row.points));
    cells.push(row.details || "");
    lines.push(cells.join("\t"));
  }
  return lines.join("\n");
}

function extractFromSeason(season: string, markdown: string): DivisionExtract[] {
  const pages = splitPages(markdown);
  const buckets = new Map<
    string,
    { sport: string; division: string; grids: ParsedGrid[]; awards: ExtractedAwards; sources: string[] }
  >();

  let currentSport: string | null = null;

  const addGrid = (
    sport: string,
    division: string,
    grid: ParsedGrid,
    awards: ExtractedAwards,
    source: string
  ) => {
    if (!isTeamStandingsGrid(grid)) return;
    const key = `${sport}|${normalizeDivision(division)}`;
    const bucket = buckets.get(key) ?? {
      sport,
      division: normalizeDivision(division),
      grids: [],
      awards: { mvp: null, rookie_of_the_year: null },
      sources: [],
    };
    bucket.grids.push(grid);
    if (!bucket.awards.mvp && awards.mvp) bucket.awards.mvp = awards.mvp;
    if (!bucket.awards.rookie_of_the_year && awards.rookie_of_the_year) {
      bucket.awards.rookie_of_the_year = awards.rookie_of_the_year;
    }
    if (!bucket.sources.includes(source)) bucket.sources.push(source);
    buckets.set(key, bucket);
  };

  for (const page of pages) {
    const pageSport = inferSport(page.text) || currentSport;
    if (pageSport) currentSport = pageSport;
    if (!currentSport) continue;
    if (looksLikeGameResults(page.text) || looksLikePlayerStatsPage(page.text)) continue;

    const divisions = ["Men's", "Women's", "Juniors", "Boys", "Girls", "Collegiate"];
    let usedSlice = false;
    for (const division of divisions) {
      const sliced = sliceReportForDivision(page.text, division);
      if (!sliced.sliced) continue;
      usedSlice = true;
      const awards = extractAwardsFromText(sliced.text);
      for (const grid of parseMarkdownTables(sliced.text)) addGrid(currentSport, division, grid, awards, page.id);
      const placement = parsePlacementLines(sliced.text);
      if (placement) addGrid(currentSport, division, placement, awards, page.id);
    }

    if (!usedSlice) {
      const awards = extractAwardsFromText(page.text);
      const fallbackDivision =
        /junior/i.test(page.text) ? "Juniors" : /women/i.test(page.text) ? "Women's" : "Men's";
      for (const grid of parseMarkdownTables(page.text)) {
        addGrid(currentSport, fallbackDivision, grid, awards, page.id);
      }
      const placement = parsePlacementLines(page.text);
      if (placement) addGrid(currentSport, fallbackDivision, placement, awards, page.id);
    }
  }

  // Whole-book fallback for sports whose headings don't sit on the same page as the table.
  for (const sport of SPORTS) {
    const sportBlocks = markdown.split(/(?=^#{1,4}\s)/m).filter((block) => sport.pattern.test(block.slice(0, 400)));
    for (const block of sportBlocks) {
      for (const division of ["Men's", "Women's", "Juniors", "Boys", "Girls", "Collegiate"]) {
        const sliced = sliceReportForDivision(block, division);
        const text = sliced.sliced ? sliced.text : block;
        if (!sliced.sliced && sport.name !== "General Championship") continue;
        const awards = extractAwardsFromText(text);
        const key = `${sport.name}|${normalizeDivision(division)}`;
        if (buckets.has(key) && (buckets.get(key)?.grids.length || 0) > 0) continue;
        for (const grid of parseMarkdownTables(text)) addGrid(sport.name, division, grid, awards, "book");
        const placement = parsePlacementLines(text);
        if (placement) addGrid(sport.name, division, placement, awards, "book");
      }
    }
  }

  const extracts: DivisionExtract[] = [];
  for (const bucket of buckets.values()) {
    const uaapRows = bucket.grids
      .flatMap((grid) => rowsFromGrid(grid))
      .filter((row) => matchSchoolCode(row.team));
    const rows = mergeDivisionRows(
      toStandingRows(season, bucket.sport, bucket.division, uaapRows, bucket.sources.join(", "), bucket.awards)
    );
    if (rows.length < 3 || rows.length > 12) continue;
    extracts.push({
      season,
      sport: bucket.sport,
      division: bucket.division,
      paste: pasteFromRows(rows),
      rows,
      awards: bucket.awards,
      source: bucket.sources.join(", "),
    });
  }

  return extracts.sort(
    (a, b) => a.sport.localeCompare(b.sport) || a.division.localeCompare(b.division)
  );
}

function parseCsvStandings(filePath: string): StandingRow[] {
  if (!fs.existsSync(filePath)) return [];
  const [headerLine, ...lines] = fs.readFileSync(filePath, "utf-8").trim().split(/\r?\n/);
  const headers = headerLine.split(",").map((h) => h.trim());
  const idx = (name: string) => headers.indexOf(name);
  const rows: StandingRow[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split(",");
    const team = (cols[idx("team")] || "").trim();
    if (!team) continue;
    const code = matchSchoolCode(team) || team;
    const season = (cols[idx("season")] || "").trim();
    const sport = (cols[idx("sport")] || "").trim();
    const division = normalizeDivision(cols[idx("division")] || "");
    if (!season || !sport || !division) continue;
    if (!SPORTS.some((s) => s.name === sport)) continue;
    rows.push({
      season,
      sport,
      division,
      stage: (cols[idx("stage")] || "Final Standings").trim(),
      rank: Number(cols[idx("rank")]) || 0,
      team: code,
      team_name: getSchoolName(code) || code,
      wins: num(cols[idx("wins")]),
      losses: num(cols[idx("losses")]),
      points: num(cols[idx("points")]),
      details: (cols[idx("details")] || "").trim() || null,
      mvp: null,
      rookie: null,
      source: path.basename(filePath),
    });
  }
  return rows;
}

function loadStructuredFallback(existingKeys: Set<string>): StandingRow[] {
  const structuredDir = path.join(ROOT, "data", "structured");
  if (!fs.existsSync(structuredDir)) return [];
  const sportMap: Record<string, string> = {
    basketball: "Basketball",
    volleyball: "Volleyball",
    badminton: "Badminton",
    table_tennis: "Table Tennis",
    taekwondo: "Tae Kwon Do",
    baseball: "Baseball",
    softball: "Softball",
    judo: "Judo",
    football: "Football",
    fencing: "Fencing",
    chess: "Chess",
    tennis: "Lawn Tennis",
    swimming: "Swimming",
    overall_standings: "General Championship",
  };
  const divMap: Record<string, string> = {
    men: "Men's",
    women: "Women's",
    juniors: "Juniors",
    college: "Collegiate",
    high_school: "Juniors",
    boys: "Boys",
    girls: "Girls",
  };
  const extra: StandingRow[] = [];
  for (const sportKey of fs.readdirSync(structuredDir)) {
    const sportName = sportMap[sportKey] || sportKey.replace(/_/g, " ");
    if (!SPORTS.some((s) => s.name === sportName)) continue;
    const standingsDir =
      sportKey === "overall_standings"
        ? path.join(structuredDir, sportKey)
        : path.join(structuredDir, sportKey, "standings");
    if (!fs.existsSync(standingsDir)) continue;
    for (const file of fs.readdirSync(standingsDir).filter((f) => f.endsWith(".json"))) {
      const season = path.basename(file, ".json");
      const data = JSON.parse(fs.readFileSync(path.join(standingsDir, file), "utf-8"));
      for (const [divKey, entries] of Object.entries(data.divisions || {})) {
        const division = divMap[divKey] || String(divKey);
        const key = `${season}|${sportName}|${division}`;
        if (existingKeys.has(key)) continue;
        if (!Array.isArray(entries)) continue;
        for (const item of entries as Array<Record<string, unknown>>) {
          const team = String(item.school || item.team || "");
          if (!team) continue;
          const code = matchSchoolCode(team) || team;
          extra.push({
            season,
            sport: sportName,
            division,
            stage: "Final Standings",
            rank: Number(item.rank) || 0,
            team: code,
            team_name: getSchoolName(code) || code,
            wins: num(item.wins),
            losses: num(item.losses),
            points: num(item.points ?? item.total_points),
            details: (item.details as string) || (item.notes as string) || null,
            mvp: null,
            rookie: null,
            source: `structured/${sportKey}/${file}`,
          });
        }
      }
    }
  }
  return extra;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownToHtmlBody(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];
  let inTable = false;

  const flushTable = (rows: string[]) => {
    out.push("<table>");
    rows.forEach((row, idx) => {
      let trimmed = row.trim();
      if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
      if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
      const cells = trimmed.split("|").map((c) => c.trim().replace(/\*\*/g, ""));
      if (idx === 1 && cells.every((c) => /^:?-{2,}:?$/.test(c))) return;
      const tag = idx === 0 ? "th" : "td";
      out.push("<tr>" + cells.map((c) => `<${tag}>${escapeHtml(c)}</${tag}>`).join("") + "</tr>");
    });
    out.push("</table>");
  };

  let tableBuf: string[] = [];
  for (const line of lines) {
    const isTable = line.trim().startsWith("|") && line.includes("|");
    if (isTable) {
      inTable = true;
      tableBuf.push(line);
      continue;
    }
    if (inTable) {
      flushTable(tableBuf);
      tableBuf = [];
      inTable = false;
    }
    if (/^\s*---+\s*$/.test(line)) {
      out.push("<hr />");
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].replace(/\*\*/g, "");
      const id = slug(text).toLowerCase();
      out.push(`<h${level} id="${id}">${escapeHtml(text)}</h${level}>`);
      continue;
    }
    if (!line.trim()) {
      out.push("");
      continue;
    }
    out.push(`<p>${escapeHtml(line.replace(/\*\*(.*?)\*\*/g, "$1"))}</p>`);
  }
  if (inTable) flushTable(tableBuf);
  return out.join("\n");
}

function compileBook(seasonFiles: Array<{ season: string; markdown: string; sourceFile: string }>): {
  markdown: string;
  html: string;
} {
  const toc = seasonFiles
    .map((s) => `- [${s.season}](#season-${s.season})`)
    .join("\n");
  const parts = [
    "# UAAP Annual Reports — Complete Digital Book",
    "",
    `Compiled from ${seasonFiles.length} transcribed season books.`,
    "",
    "## Contents",
    "",
    toc,
    "",
  ];
  for (const file of seasonFiles) {
    parts.push(`# Season ${file.season}`);
    parts.push("");
    parts.push(`<a id="season-${file.season}"></a>`);
    parts.push("");
    parts.push(`*Source: \`${file.sourceFile}\`*`);
    parts.push("");
    parts.push(file.markdown.trim());
    parts.push("");
    parts.push("---");
    parts.push("");
  }
  const markdown = parts.join("\n");

  const htmlToc = seasonFiles
    .map((s) => `<a href="#season-${s.season}">${s.season}</a>`)
    .join("\n");
  const htmlSections = seasonFiles
    .map((s) => {
      const body = markdownToHtmlBody(s.markdown);
      return `<section id="season-${s.season}"><h1>Season ${escapeHtml(s.season)}</h1>\n${body}\n</section>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>UAAP Annual Reports — Complete Digital Book</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; font-family: Georgia, serif; background: #0f1419; color: #e8e6e3; }
    nav { position: sticky; top: 0; display: flex; flex-wrap: wrap; gap: 12px; padding: 12px 20px; background: #1a222b; border-bottom: 1px solid #314155; z-index: 5; }
    nav a { color: #f5c542; text-decoration: none; font-family: sans-serif; font-size: 14px; }
    main { max-width: 980px; margin: 0 auto; padding: 24px; }
    h1, h2, h3, h4 { font-family: sans-serif; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0 24px; font-size: 14px; }
    th, td { border: 1px solid #314155; padding: 4px 8px; }
    th { background: #1a222b; }
    hr { border: 0; border-top: 1px solid #314155; margin: 32px 0; }
    p { line-height: 1.45; }
  </style>
</head>
<body>
  <nav>${htmlToc}</nav>
  <main>
    <h1>UAAP Annual Reports — Complete Digital Book</h1>
    ${htmlSections}
  </main>
</body>
</html>
`;
  return { markdown, html };
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(filePath: string, rows: StandingRow[]) {
  const headers = [
    "season",
    "sport",
    "division",
    "stage",
    "rank",
    "team",
    "team_name",
    "wins",
    "losses",
    "points",
    "details",
    "mvp",
    "rookie",
    "source",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((key) => csvEscape((row as Record<string, unknown>)[key])).join(","));
  }
  fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
}

function writePastePack(extracts: DivisionExtract[]): string {
  const lines: string[] = [
    "# UAAP Archive — Admin paste pack",
    "",
    "Each block is ready for **Admin → UAAP Archive → Bulk import**.",
    "",
    "1. Set Season, Sport, and Division to the heading.",
    "2. Open Bulk import (or Import from scan).",
    "3. Copy the table (including the header row) and Parse → Apply to editor → Save.",
    "",
    "## Index",
    "",
  ];
  for (const item of extracts) {
    const anchor = slug(`${item.season}-${item.sport}-${item.division}`).toLowerCase();
    lines.push(`- [${item.season} · ${item.sport} · ${item.division}](#${anchor}) — ${item.rows.length} teams`);
  }
  lines.push("");
  for (const item of extracts) {
    const anchor = slug(`${item.season}-${item.sport}-${item.division}`).toLowerCase();
    const awards = [
      item.awards.mvp ? `MVP ${item.awards.mvp.player} (${item.awards.mvp.school})` : null,
      item.awards.rookie_of_the_year
        ? `ROTY ${item.awards.rookie_of_the_year.player} (${item.awards.rookie_of_the_year.school})`
        : null,
    ].filter(Boolean);
    lines.push(`## ${item.season} · ${item.sport} · ${item.division}`);
    lines.push(`<a id="${anchor}"></a>`);
    lines.push("");
    lines.push(`Admin path: season \`${item.season}\` · sport \`${item.sport}\` · division \`${item.division}\``);
    if (awards.length) lines.push(`Awards: ${awards.join(" · ")}`);
    lines.push(`Source: ${item.source}`);
    lines.push("");
    lines.push("```");
    lines.push(item.paste);
    lines.push("```");
    lines.push("");
  }
  return lines.join("\n");
}

function main() {
  fs.mkdirSync(PASTE_DIR, { recursive: true });

  const seasonFiles: Array<{ season: string; markdown: string; sourceFile: string }> = [];
  const extracts: DivisionExtract[] = [];

  for (const season of SEASONS) {
    const bookPath = findSeasonBook(season);
    if (!bookPath) {
      console.warn(`No annual report markdown for ${season}`);
      continue;
    }
    const markdown = fs.readFileSync(bookPath, "utf-8");
    seasonFiles.push({ season, markdown, sourceFile: path.basename(bookPath) });
    const found = extractFromSeason(season, markdown);
    console.log(`${season}: ${found.length} division tables from ${path.basename(bookPath)}`);
    extracts.push(...found);
  }

  const csvRows = [
    ...parseCsvStandings(path.join(ROOT, "data", "uaap_2003_2004_team_standings.csv")),
    ...parseCsvStandings(path.join(ROOT, "data", "uaap_team_standings_local_accurate.csv")),
  ];
  const csvByKey = new Map<string, StandingRow[]>();
  for (const row of csvRows) {
    const key = `${row.season}|${row.sport}|${row.division}`;
    const list = csvByKey.get(key) ?? [];
    list.push(row);
    csvByKey.set(key, list);
  }

  for (const item of extracts) {
    const key = `${item.season}|${item.sport}|${item.division}`;
    const csv = csvByKey.get(key);
    if (!csv) continue;
    const wins = item.rows.map((r) => r.wins).filter((w): w is number => w !== null);
    const allSameWins = wins.length >= 3 && wins.every((w) => w === wins[0]);
    const csvMerged = mergeDivisionRows(csv);
    if (allSameWins || item.rows.every((r) => r.wins === null) && csvMerged.some((r) => r.wins !== null)) {
      item.rows = mergeDivisionRows([...csvMerged, ...item.rows]);
      item.paste = pasteFromRows(item.rows);
      item.source = `${item.source}; ${csvMerged[0]?.source || "csv"}`;
    }
  }

  let existing = new Set(extracts.map((e) => `${e.season}|${e.sport}|${e.division}`));
  for (const [key, rows] of csvByKey) {
    if (existing.has(key)) continue;
    const [season, sport, division] = key.split("|");
    const merged = mergeDivisionRows(rows);
    if (merged.length < 3) continue;
    extracts.push({
      season,
      sport,
      division,
      paste: pasteFromRows(merged),
      rows: merged,
      awards: { mvp: null, rookie_of_the_year: null },
      source: merged[0]?.source || "csv",
    });
    existing.add(key);
  }

  const fallbackRows = loadStructuredFallback(existing);
  if (fallbackRows.length) {
    const byKey = new Map<string, StandingRow[]>();
    for (const row of fallbackRows) {
      const key = `${row.season}|${row.sport}|${row.division}`;
      const list = byKey.get(key) ?? [];
      list.push(row);
      byKey.set(key, list);
    }
    for (const [key, rows] of byKey) {
      const [season, sport, division] = key.split("|");
      const merged = mergeDivisionRows(rows);
      if (merged.length < 3 || merged.length > 12) continue;
      extracts.push({
        season,
        sport,
        division,
        paste: pasteFromRows(merged),
        rows: merged,
        awards: { mvp: null, rookie_of_the_year: null },
        source: merged[0]?.source || "structured",
      });
    }
    console.log(`Structured fallback filled missing divisions.`);
  }

  extracts.sort(
    (a, b) =>
      b.season.localeCompare(a.season) ||
      a.sport.localeCompare(b.sport) ||
      a.division.localeCompare(b.division)
  );

  fs.rmSync(PASTE_DIR, { recursive: true, force: true });
  for (const item of extracts) {
    const seasonPasteDir = path.join(PASTE_DIR, item.season);
    fs.mkdirSync(seasonPasteDir, { recursive: true });
    fs.writeFileSync(
      path.join(seasonPasteDir, `${slug(item.sport)}_${slug(item.division)}.txt`),
      `# ${item.season} | ${item.sport} | ${item.division}\n# Paste into Admin → UAAP Archive → Bulk import\n\n${item.paste}\n`,
      "utf-8"
    );
  }

  const allRows = extracts.flatMap((e) => e.rows);
  const book = compileBook(seasonFiles);

  fs.writeFileSync(path.join(OUT_DIR, "UAAP_Complete_Digital_Book.md"), book.markdown, "utf-8");
  fs.writeFileSync(path.join(OUT_DIR, "UAAP_Complete_Digital_Book.html"), book.html, "utf-8");
  fs.writeFileSync(path.join(OUT_DIR, "UAAP_Admin_Paste_Pack.md"), writePastePack(extracts), "utf-8");
  writeCsv(path.join(OUT_DIR, "uaap_standings_master.csv"), allRows);

  const py = `
import csv
from pathlib import Path
try:
    import pandas as pd
except ImportError:
    raise SystemExit("pandas missing")
csv_path = Path(r"${path.join(OUT_DIR, "uaap_standings_master.csv").replace(/\\/g, "/")}")
xlsx_path = Path(r"${path.join(OUT_DIR, "uaap_standings_master.xlsx").replace(/\\/g, "/")}")
df = pd.read_csv(csv_path)
with pd.ExcelWriter(xlsx_path, engine="openpyxl") as writer:
    df.to_excel(writer, sheet_name="Master", index=False)
    coverage = (
        df.groupby(["season", "sport", "division"], dropna=False)
        .size()
        .reset_index(name="teams")
        .sort_values(["season", "sport", "division"], ascending=[False, True, True])
    )
    coverage.to_excel(writer, sheet_name="Coverage", index=False)
    for sport, group in df.groupby("sport"):
        name = str(sport).replace("/", "-")[:31]
        group.sort_values(["season", "division", "rank"]).to_excel(writer, sheet_name=name, index=False)
print(xlsx_path)
`;
  const pyFile = path.join(OUT_DIR, "_write_xlsx.py");
  fs.writeFileSync(pyFile, py, "utf-8");
  const result = spawnSync("python", [pyFile], { encoding: "utf-8" });
  if (result.status !== 0) {
    console.warn("Excel write skipped:", (result.stderr || result.stdout || "").trim());
  } else {
    console.log("Excel:", (result.stdout || "").trim());
  }
  try {
    fs.unlinkSync(pyFile);
  } catch {
    // ignore
  }

  console.log(`\nWrote ${seasonFiles.length} season books, ${extracts.length} paste tables, ${allRows.length} standing rows.`);
  console.log(`Digital book: ${path.join(OUT_DIR, "UAAP_Complete_Digital_Book.html")}`);
  console.log(`Paste pack:   ${path.join(OUT_DIR, "UAAP_Admin_Paste_Pack.md")}`);
  console.log(`Master CSV:   ${path.join(OUT_DIR, "uaap_standings_master.csv")}`);
}

main();
