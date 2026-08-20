import type { League, TournamentStage } from "@/types/sports";
import * as cheerio from "cheerio";
import { extractText } from "unpdf";

type CheerioSelection = ReturnType<cheerio.CheerioAPI>;





export interface ExtractedBoxRow {
  playerName: string;
  jersey?: number | null;
  min: string;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  to?: number;
  pf?: number;
  fgM: number;
  fgA: number;
  threeM?: number;
  threeA?: number;
  ftM?: number;
  ftA?: number;
}

export interface ExtractedGamePayload {
  league: League;
  stage: TournamentStage;
  isPlayoff: boolean;
  status: "FINAL" | "LIVE" | "UPCOMING";
  competition: string;
  venue?: string;
  startTime: string;
  homeTeam: {
    name: string;
    shortName: string;
    score: number;
  };
  awayTeam: {
    name: string;
    shortName: string;
    score: number;
  };
  boxScore: {
    home: ExtractedBoxRow[];
    away: ExtractedBoxRow[];
  };
  note?: string;
}

const PBA_TOURNAMENTS = [
  "pba-50th-season-governors-cup",
  "pba-50th-season-commissioner-s-cup",
  "pba-50th-season-philippine-cup",
  "pba-49th-season-philippine-cup",
];

const UAAP_TOURNAMENTS = [
  "uaap-season-87-men-s-basketball",
  "uaap-season-88-men-s-basketball",
  "uaap-season-86-men-s-basketball",
];

const STAT_COLUMNS_UAAP = {
  mins: 3,
  pts: 4,
  fg2_pct: 8,
  fg3_pct: 10,
  ft_pct: 12,
  reb: 15,
  ast: 16,
  to: 17,
  stl: 18,
  blk: 19,
  pf: 20,
  fls_on: 21,
  plus_minus: 22,
};

const STAT_COLUMNS_PBA = {
  mins: 3,
  pts: 4,
  fg2_pct: 8,
  fg3_pct: 10,
  fg4: 11,
  fg4_pct: 12,
  ft_pct: 14,
  reb: 17,
  ast: 18,
  to: 19,
  stl: 20,
  blk: 21,
  pf: 22,
  fls_on: 23,
  plus_minus: 24,
};

const SKIP_PLAYER_NAMES = new Set([
  "starters",
  "bench",
  "team totals",
  "team / coach",
  "dnp",
  "did not play",
]);

function parseNumber(value?: string | null): number | null {
  if (!value) return null;
  const cleaned = value.replace(/,/g, "").replace(/%/g, "").trim();
  if (!cleaned || cleaned.toUpperCase() === "DNP" || cleaned === "-") return null;
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

function parseIsoDate(rawDate?: string): string {
  if (!rawDate) return new Date().toISOString();
  try {
    const parts = rawDate.split(/\s+/);
    if (parts.length >= 1 && parts[0].includes("/")) {
      const dParts = parts[0].split("/").map(Number);
      if (dParts.length === 3) {
        const month = dParts[0];
        const day = dParts[1];
        let year = dParts[2];
        if (year < 100) year += 2000;
        let hour = 16;
        let minute = 0;
        if (parts.length >= 2 && parts[1].includes(":")) {
          const tParts = parts[1].split(":").map(Number);
          hour = tParts[0] || 0;
          minute = tParts[1] || 0;
        }
        return new Date(Date.UTC(year, month - 1, day, hour, minute)).toISOString();
      }

    }
  } catch {
    // Fall back to current date
  }
  return new Date().toISOString();
}

function estimateShooting(pts: number, fg2Pct: number, fg3Pct: number, ftPct: number) {
  const ftM = Math.max(0, Math.round(pts * 0.15));
  const remaining = Math.max(0, pts - ftM);
  const threeShare = fg3Pct > 0 ? 0.35 : 0.1;
  const threeM = Math.max(0, Math.round((remaining * threeShare) / 3));
  const twoPts = Math.max(0, remaining - threeM * 3);
  const fg2M = Math.max(0, Math.round(twoPts / 2));
  const fgM = fg2M + threeM;

  const fg2A = fg2Pct > 0 ? Math.max(fg2M, Math.round(fg2M / (fg2Pct / 100))) : Math.max(fg2M, fg2M + 2);
  const threeA = fg3Pct > 0 ? Math.max(threeM, Math.round(threeM / (fg3Pct / 100))) : threeM;
  const fgA = fg2A + threeA;
  const ftA = ftPct > 0 ? Math.max(ftM, Math.round(ftM / (ftPct / 100))) : ftM;

  return { fgM, fgA, threeM, threeA, ftM, ftA };
}

function resolveCandidateUrls(rawInput: string, league: League): string[] {
  const raw = rawInput.trim();

  // 1. Direct LiveStats URLs
  if (raw.includes("pba-api01.actech2.com") || raw.includes("uaap.livestats.ph")) {
    return [raw];
  }

  // 2. PBA recap URL e.g. https://pba.ph/recap?match=553 or raw match ID
  let matchId: string | null = null;
  if (raw.includes("pba.ph")) {
    try {
      const u = new URL(raw);
      matchId = u.searchParams.get("match") || u.searchParams.get("game_id");
    } catch {
      const match = raw.match(/[?&]match=(\d+)/i) || raw.match(/[?&]game_id=(\d+)/i);
      if (match) matchId = match[1];
    }
  } else if (/^\d+$/.test(raw)) {
    matchId = raw;
  }

  if (matchId && league === "PBA") {
    return PBA_TOURNAMENTS.map((t) => `https://pba-api01.actech2.com/tournaments/${t}?game_id=${matchId}`);
  }

  if (matchId && league === "UAAP") {
    return UAAP_TOURNAMENTS.map((t) => `https://uaap.livestats.ph/tournaments/${t}?game_id=${matchId}`);
  }

  return [raw];
}

const KNOWN_PVL_TEAMS: Record<string, string> = {
  FFF: "Farm Fresh Foxies",
  NXL: "Nxled Chameleons",
  NXG: "Nxled Chameleons",
  CCS: "Creamline Cool Smashers",
  CREAM: "Creamline Cool Smashers",
  CMF: "Choco Mucho Flying Titans",
  PGA: "Petro Gazz Angels",
  CTC: "Cignal HD Spikers",
  PLDT: "PLDT High Speed Hitters",
  AKR: "Akari Power Chargers",
  AKARI: "Akari Power Chargers",
  ZUS: "Zus Coffee Thunderbelles",
  CAP: "Capital1 Solar Spikers",
  CAP1: "Capital1 Solar Spikers",
  GAL: "Galeries Tower Highrisers",
  GTH: "Galeries Tower Highrisers",
  CHE: "Chery Tiggo Crossovers",
  FTL: "F2 Logistics Cargo Movers",
};

function formatPvlPlayerName(raw: string): string {
  const parts = raw.trim().split(/\s+/);
  if (parts.length <= 1) return raw.trim();

  const lastParts: string[] = [];
  const firstParts: string[] = [];

  for (const part of parts) {
    if (part === "L" || part === "Captain" || part === "C") continue;
    if (part === part.toUpperCase() && part.length > 1) {
      lastParts.push(part.charAt(0) + part.slice(1).toLowerCase());
    } else {
      firstParts.push(part);
    }
  }

  const first = firstParts.join(" ");
  const last = lastParts.join(" ");
  if (first && last) return `${first} ${last}`;
  return parts.join(" ");
}

export async function parseNativePvlPdf(
  buffer: Uint8Array,
  stage: TournamentStage = "ELIMINATION",
  status: "FINAL" | "LIVE" | "UPCOMING" = "FINAL"
): Promise<ExtractedGamePayload | null> {
  try {
    const { text } = await extractText(buffer);
    const rawText = Array.isArray(text) ? text.join("\n") : String(text || "");
    if (!rawText.trim()) return null;

    const lines = rawText.split("\n").map((l: string) => l.trim()).filter(Boolean);

    // 1. Tournament
    const tourneyLine = lines.find((l: string) => l.includes("PVL")) || "PVL Conference";
    const tournament = tourneyLine.replace(/^[^\w]+/, "").trim();

    // 2. Date (Bounded MM/DD/YYYY matching 2020-2035)
    const dateMatch =
      rawText.match(/\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(20[2-3]\d)\b/) ||
      rawText.match(/\b(20[2-3]\d)[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/);
    let startTime = new Date().toISOString();
    if (dateMatch) {
      if (dateMatch[0].includes("/")) {
        const [m, d, y] = dateMatch[0].split("/").map(Number);
        startTime = new Date(Date.UTC(y, m - 1, d, 16, 0)).toISOString();
      } else {
        const [y, m, d] = dateMatch[0].split("-").map(Number);
        startTime = new Date(Date.UTC(y, m - 1, d, 16, 0)).toISOString();
      }
    }


    // 3. Venue
    let venue = "PhilSports Arena";
    const hallIdx = lines.findIndex((l: string) => l === "Hall:" || l.startsWith("Hall:"));
    let hall = "";
    let city = "";

    if (hallIdx !== -1) {
      // In VIS PDFs, values appear 2 lines and 3 lines after Hall:
      // Line [hallIdx + 2]: "LANAO DEL NORTE" (City)
      // Line [hallIdx + 3]: "MCC GYMNASIUM" (Hall)
      if (lines[hallIdx + 3] && !lines[hallIdx + 3].startsWith("Match") && !lines[hallIdx + 3].startsWith("VIS")) {
        hall = lines[hallIdx + 3];
      }
      if (lines[hallIdx + 2] && !/\d{2,}/.test(lines[hallIdx + 2])) {
        city = lines[hallIdx + 2];
      }
    }

    if (!hall) {
      const detectedHall = lines.find(
        (l: string) =>
          (l.includes("GYMNASIUM") ||
            l.includes("COLISEUM") ||
            l.includes("ARENA") ||
            l.includes("COMPLEX") ||
            l.includes("CENTER") ||
            l.includes("HALL")) &&
          !l.includes("•") &&
          !l.includes("Match") &&
          !l.includes("VIS")
      );
      if (detectedHall) hall = detectedHall;
    }

    if (hall && city && !hall.toLowerCase().includes(city.toLowerCase())) {
      venue = `${hall}, ${city}`;
    } else if (hall) {
      venue = hall;
    } else if (city) {
      venue = city;
    }



    // 4. Team codes
    const teamCodesFound: string[] = [];
    for (const code of Object.keys(KNOWN_PVL_TEAMS)) {
      if (rawText.includes(`${code} •`) || rawText.includes(`${code}\n`)) {
        if (!teamCodesFound.includes(code)) {
          teamCodesFound.push(code);
        }
      }
    }

    const codeA = teamCodesFound[0] || "FFF";
    const codeB = teamCodesFound[1] || "NXL";

    let scoreA = 3;
    let scoreB = 0;

    const setsMatch = rawText.match(new RegExp(`${codeA}[\\s\\S]*?${codeB}\\s*(\\d+)[\\s\\S]*?(\\d+)`));
    if (setsMatch) {
      scoreB = parseInt(setsMatch[1], 10);
      scoreA = parseInt(setsMatch[2], 10);
    }

    function extractRoster(code: string): ExtractedBoxRow[] {
      const startPattern = `${code} •`;
      const startIdx = rawText.indexOf(startPattern);
      if (startIdx === -1) return [];

      const sub = rawText.slice(startIdx);
      const endIdx = sub.indexOf("Coach:");
      const chunk = endIdx !== -1 ? sub.slice(0, endIdx) : sub;

      const chunkLines = chunk.split("\n").map((l: string) => l.trim()).filter(Boolean);
      const players: ExtractedBoxRow[] = [];

      const pointNumbers: number[] = [];
      for (const cl of chunkLines) {
        if (/^\d{1,2}$/.test(cl)) {
          pointNumbers.push(parseInt(cl, 10));
        }
      }

      let pCount = 0;
      for (const cl of chunkLines) {
        if (cl.includes("•") || cl.startsWith("Coach") || cl.startsWith("Assistant") || cl.startsWith("Referees")) {
          continue;
        }
        const pMatch = cl.match(/^(\d{1,2})\s+([A-Za-z\s\-]+?)(?:\t|\s+)(L)?$/i) || cl.match(/^(\d{1,2})\s+([A-Za-z\s\-]+)$/);
        if (pMatch) {
          const jersey = parseInt(pMatch[1], 10);
          const rawName = pMatch[2].trim();
          const isLibero = Boolean(pMatch[3] || cl.includes("\tL") || cl.endsWith(" L"));

          if (rawName && !rawName.toLowerCase().startsWith("coach") && !rawName.toLowerCase().startsWith("assistant")) {
            const pts = !isLibero && pCount < pointNumbers.length ? pointNumbers[pCount] : 0;
            players.push({
              playerName: formatPvlPlayerName(rawName),
              jersey,
              min: "Sets",
              pts,
              reb: 0,
              ast: 0,
              stl: 0,
              blk: 0,
              to: 0,
              pf: 0,
              fgM: pts,
              fgA: pts,
            });
            if (!isLibero) pCount++;
          }
        }
      }

      return players;
    }

    const homePlayers = extractRoster(codeA);
    const awayPlayers = extractRoster(codeB);

    return {
      league: "PVL",
      stage,
      isPlayoff: stage !== "ELIMINATION",
      status,
      competition: tournament,
      venue,
      startTime,
      homeTeam: {
        name: KNOWN_PVL_TEAMS[codeA] || `${codeA} Team`,
        shortName: codeA,
        score: scoreA,
      },
      awayTeam: {
        name: KNOWN_PVL_TEAMS[codeB] || `${codeB} Team`,
        shortName: codeB,
        score: scoreB,
      },
      boxScore: {
        home: homePlayers,
        away: awayPlayers,
      },
    };
  } catch (err) {
    console.error("[PVL PDF Native Parse Error]:", err);
    return null;
  }
}

export async function extractGameFromUrl(
  rawInput: string,
  league: League = "UAAP",
  stage: TournamentStage = "ELIMINATION",
  status: "FINAL" | "LIVE" | "UPCOMING" = "FINAL"
): Promise<ExtractedGamePayload> {
  if (league === "PVL" || rawInput.toLowerCase().endsWith(".pdf") || rawInput.includes("dashboard.pvl.ph")) {
    if (rawInput.startsWith("http://") || rawInput.startsWith("https://")) {
      const res = await fetch(rawInput, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to download PVL match PDF: HTTP ${res.status}`);
      }
      const buffer = new Uint8Array(await res.arrayBuffer());
      const nativePayload = await parseNativePvlPdf(buffer, stage, status);
      if (nativePayload) return nativePayload;
      throw new Error("Could not parse match tables from PVL PDF sheet.");
    }
  }




  const candidates = resolveCandidateUrls(rawInput, league);
  let html = "";
  let lastError: Error | null = null;

  for (const targetUrl of candidates) {
    try {
      const res = await fetch(targetUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (res.ok) {
        const text = await res.text();
        if (text.includes("boxscorewrap") || text.includes("box-score_title")) {
          html = text;
          break;
        }
      }
    } catch (err: unknown) {
      lastError = err as Error;
    }
  }

  if (!html) {
    throw new Error(
      lastError?.message ||
        `Could not fetch valid LiveStats match data. Please verify the URL or Match ID (${rawInput}).`
    );
  }

  const $ = cheerio.load(html);
  const details: Record<string, string> = {};

  $(".game-detail").each((_, el) => {
    const text = $(el).text().trim();
    if (text.toLowerCase().startsWith("competition ")) {
      details.competition = text.slice("competition ".length).trim();
    } else if (text.toLowerCase().startsWith("venue ")) {
      details.venue = text.slice("venue ".length).trim();
    } else if (text.toLowerCase().startsWith("game details ")) {
      details.gameDate = text.slice("game details ".length).trim();
    }
  });

  const wraps = $(".boxscorewrap");
  if (wraps.length < 2) {
    throw new Error("No completed box score tables found in match page.");
  }

  const statCols = league === "PBA" ? STAT_COLUMNS_PBA : STAT_COLUMNS_UAAP;
  const teamsMeta: Array<{ name: string; shortName: string; score: number; wrapEl: CheerioSelection }> = [];

  wraps.each((_, wrap) => {
    const wrapEl = $(wrap);
    const titleEl = wrapEl.prevAll(".box-score_title").first();
    const rawTitle = titleEl.text().trim();
    const cleanTitle = rawTitle.replace(/\s*Coach:.*$/i, "").trim();
    const shortName = cleanTitle.split(/\s+/)[0] || cleanTitle;

    let displayName = cleanTitle;
    if (cleanTitle.startsWith(shortName + " ")) {
      displayName = cleanTitle.slice(shortName.length).trim();
    }

    const totalsRow = wrapEl.find("tr.team-totals");
    const scoreCell = totalsRow.find("td").eq(4).text().trim();
    const score = parseNumber(scoreCell) || 0;

    teamsMeta.push({
      name: displayName || cleanTitle || "Unknown Team",
      shortName,
      score,
      wrapEl,
    });
  });

  if (teamsMeta.length < 2) {
    throw new Error("Expected 2 teams in box score tables.");
  }

  const homeMeta = teamsMeta[0];
  const awayMeta = teamsMeta[1];

  function extractPlayers(wrapEl: CheerioSelection): ExtractedBoxRow[] {
    const rows: ExtractedBoxRow[] = [];
    const table = wrapEl.find("table");
    if (!table.length) return rows;




    table.find("tbody tr").each((_, tr) => {
      const trEl = $(tr);
      if (
        trEl.hasClass("team-totals") ||
        trEl.hasClass("team-coach") ||
        trEl.hasClass("bsheader_type")
      ) {
        return;
      }

      const cells = trEl.find("td").map((__, td) => $(td).text().trim()).get();
      if (cells.length < 5) return;

      const playerName = cells[1] || "";
      if (!playerName || SKIP_PLAYER_NAMES.has(playerName.toLowerCase())) return;

      const jersey = parseNumber(cells[0]);
      const min = cells[statCols.mins] || "0:00";
      const pts = parseNumber(cells[statCols.pts]) || 0;
      const reb = parseNumber(cells[statCols.reb]) || 0;
      const ast = parseNumber(cells[statCols.ast]) || 0;
      const stl = parseNumber(cells[statCols.stl]) || 0;
      const blk = parseNumber(cells[statCols.blk]) || 0;
      const to = parseNumber(cells[statCols.to]) || 0;
      const pf = parseNumber(cells[statCols.pf]) || 0;

      const fg2Pct = parseNumber(cells[statCols.fg2_pct]) || 0;
      const fg3Pct = parseNumber(cells[statCols.fg3_pct]) || 0;
      const ftPct = parseNumber(cells[statCols.ft_pct]) || 0;

      const splits = estimateShooting(pts, fg2Pct, fg3Pct, ftPct);

      rows.push({
        playerName,
        jersey,
        min,
        pts,
        reb,
        ast,
        stl,
        blk,
        to,
        pf,
        ...splits,
      });
    });

    return rows;
  }

  const homeBox = extractPlayers(homeMeta.wrapEl);
  const awayBox = extractPlayers(awayMeta.wrapEl);

  return {
    league,
    stage,
    isPlayoff: stage !== "ELIMINATION",
    status,
    competition: details.competition || "",
    venue: details.venue || "",
    startTime: parseIsoDate(details.gameDate),
    homeTeam: {
      name: homeMeta.name,
      shortName: homeMeta.shortName,
      score: homeMeta.score,
    },
    awayTeam: {
      name: awayMeta.name,
      shortName: awayMeta.shortName,
      score: awayMeta.score,
    },
    boxScore: {
      home: homeBox,
      away: awayBox,
    },
  };
}
