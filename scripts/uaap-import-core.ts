import fs from "fs";
import path from "path";
import type { BoxScoreItem, Game, Player, SeasonAverages, Team } from "../types/sports";
import { buildAllTeams } from "../lib/team-catalog";

/** CSV / xlsx short codes → team-catalog slug */
export const TEAM_CODE_TO_SLUG: Record<string, string> = {
  ATENEO: "ateneo",
  UP: "up",
  LA: "dlsu",
  FEU: "feu",
  UE: "ue",
  NU: "nu",
  ADU: "adamson",
  ADAMSON: "adamson",
  UST: "ust",
};

export type UaapStatsRow = {
  game_id: string;
  game_date: string;
  venue: string;
  team: string;
  opponent: string;
  team_score: string;
  player: string;
  jersey: string;
  mins: string;
  pts: string;
  reb: string;
  ast: string;
  /** Optional — present in newer UAAP exports */
  stl?: string;
  blk?: string;
  to?: string;
  pf?: string;
  fg2_pct: string;
  fg3_pct: string;
  ft_pct: string;
};

export type UaapImportConfig = {
  seasonId: string;
  label: string;
  gameIdPrefix: string;
  sourcePath: string;
  outPath: string;
  /** 2025-26 uses short team ids (`up`); past seasons use `up-2024-25`. */
  useCurrentTeamIds: boolean;
};

function teamIdForCode(code: string, config: UaapImportConfig): string {
  const slug = TEAM_CODE_TO_SLUG[code.toUpperCase()];
  if (!slug) throw new Error(`Unknown team code: ${code}`);
  if (config.useCurrentTeamIds) return slug;
  return `${slug}-${config.seasonId}`;
}


function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseNum(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeMinutes(raw: string): string {
  const cleaned = raw.replace(/:00$/, "").trim();
  if (/^\d+:\d{2}$/.test(cleaned)) return cleaned;
  if (/^\d+:\d{2}:\d{2}$/.test(cleaned)) {
    const [h, m, s] = cleaned.split(":").map(Number);
    const totalM = h * 60 + m + Math.round(s / 60);
    return `${Math.floor(totalM / 60)}:${String(totalM % 60).padStart(2, "0")}`;
  }
  return cleaned || "0:00";
}

function parseGameDate(raw: string): string {
  const [datePart, timePart] = raw.split(" ");
  const parts = datePart.split("/").map(Number);
  if (parts.length < 3) return new Date().toISOString();
  const [month, day, rawYear] = parts;
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;

  const [hour, minute] = (timePart ?? "12:00").split(":").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day, (hour || 12) - 8, minute || 0));
  return dt.toISOString();
}

function estimateShooting(pts: number, fg2Pct: number, fg3Pct: number, ftPct: number) {
  const ftM = Math.max(0, Math.round(pts * 0.15));
  const remaining = Math.max(0, pts - ftM);
  const threeShare = fg3Pct > 0 ? 0.35 : 0.1;
  const threeM = Math.max(0, Math.round((remaining * threeShare) / 3));
  const twoPts = remaining - threeM * 3;
  const fg2M = Math.max(0, Math.round(twoPts / 2));
  const fgM = fg2M + threeM;
  const fg2A = fg2Pct > 0 ? Math.max(fg2M, Math.round(fg2M / (fg2Pct / 100))) : Math.max(fg2M, fg2M + 2);
  const threeA = fg3Pct > 0 ? Math.max(threeM, Math.round(threeM / (fg3Pct / 100))) : threeM;
  const fgA = fg2A + threeA;
  const ftA = ftPct > 0 ? Math.max(ftM, Math.round(ftM / (ftPct / 100))) : ftM;
  return { fgM, fgA, threeM, threeA, ftM, ftA };
}

function emptyAverages(): SeasonAverages {
  return {
    ppg: 0,
    rpg: 0,
    apg: 0,
    spg: 0,
    bpg: 0,
    fgPct: 0,
    threePtPct: 0,
    ftPct: 0,
  };
}

function getTeamRef(id: string, allTeams: Team[]): Team {
  const team = allTeams.find((t) => t.id === id);
  if (!team) throw new Error(`Missing catalog team: ${id}`);
  return { ...team };
}

export function importUaapStats(rows: UaapStatsRow[], config: UaapImportConfig) {
  const allTeams = buildAllTeams();

  type GameBuild = {
    gameId: string;
    date: string;
    venue: string;
    homeCode: string;
    awayCode: string;
    homeScore: number;
    awayScore: number;
    homeBox: BoxScoreItem[];
    awayBox: BoxScoreItem[];
  };

  const games = new Map<string, GameBuild>();
  const playerAgg = new Map<
    string,
    {
      player: Player;
      games: number;
      totals: {
        pts: number;
        reb: number;
        ast: number;
        stl: number;
        blk: number;
        fgPct: number;
        threePtPct: number;
        ftPct: number;
      };
    }
  >();

  for (const row of rows) {
    const gid = row.game_id;
    if (!games.has(gid)) {
      games.set(gid, {
        gameId: gid,
        date: row.game_date,
        venue: row.venue,
        homeCode: "",
        awayCode: "",
        homeScore: 0,
        awayScore: 0,
        homeBox: [],
        awayBox: [],
      });
    }

    const game = games.get(gid)!;
    const teamCode = row.team.toUpperCase();
    const oppCode = row.opponent.toUpperCase();
    const teamScore = parseNum(row.team_score);
    const pts = parseNum(row.pts);
    const reb = parseNum(row.reb);
    const ast = parseNum(row.ast);
    const stl = parseNum(row.stl ?? "0");
    const blk = parseNum(row.blk ?? "0");
    const fg2Pct = parseNum(row.fg2_pct);
    const fg3Pct = parseNum(row.fg3_pct);
    const ftPct = parseNum(row.ft_pct);
    const shooting = estimateShooting(pts, fg2Pct, fg3Pct, ftPct);

    const teamId = teamIdForCode(teamCode, config);
    const jersey = parseInt(row.jersey, 10) || 0;
    const playerKey = `${teamId}-${jersey}`;
    const playerId = `${teamId}-${jersey}`;
    const personId = slugify(row.player);

    const boxItem: BoxScoreItem = {
      playerId,
      pts,
      reb,
      ast,
      stl,
      blk,
      to: row.to !== undefined ? parseNum(row.to) : undefined,
      pf: row.pf !== undefined ? parseNum(row.pf) : undefined,
      fgM: shooting.fgM,
      fgA: shooting.fgA,
      threeM: shooting.threeM,
      threeA: shooting.threeA,
      ftM: shooting.ftM,
      ftA: shooting.ftA,
      min: normalizeMinutes(row.mins),
    };

    if (!game.homeCode) {
      game.homeCode = teamCode;
      game.awayCode = oppCode;
      game.homeScore = teamScore;
    } else if (game.homeCode === teamCode) {
      game.homeScore = teamScore;
    } else if (game.awayCode === teamCode) {
      game.awayScore = teamScore;
    }

    const isHome = game.homeCode === teamCode;
    (isHome ? game.homeBox : game.awayBox).push(boxItem);

    if (!playerAgg.has(playerKey)) {
      playerAgg.set(playerKey, {
        player: {
          id: playerId,
          personId,
          name: row.player,
          jerseyNumber: jersey,
          position: "SF",
          teamId,
          height: "6'0\"",
          photoUrl: null,
          seasonId: config.seasonId,
          seasonAverages: emptyAverages(),
          rankBadges: [],
        },
        games: 0,
        totals: { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fgPct: 0, threePtPct: 0, ftPct: 0 },
      });
    }

    const agg = playerAgg.get(playerKey)!;
    agg.games += 1;
    agg.totals.pts += pts;
    agg.totals.reb += reb;
    agg.totals.ast += ast;
    agg.totals.stl += stl;
    agg.totals.blk += blk;
    agg.totals.fgPct += fg2Pct;
    agg.totals.threePtPct += fg3Pct;
    agg.totals.ftPct += ftPct;
  }

  const importedGames: Game[] = [];
  for (const g of games.values()) {
    const awayId = teamIdForCode(g.awayCode, config);
    const homeId = teamIdForCode(g.homeCode, config);

    if (g.awayScore === 0 && g.homeScore > 0) {
      const awayRow = rows.find(
        (r) => r.game_id === g.gameId && r.team.toUpperCase() === g.awayCode
      );
      if (awayRow) g.awayScore = parseNum(awayRow.team_score);
    }

    importedGames.push({
      id: `${config.gameIdPrefix}${g.gameId}`,
      league: "UAAP",
      seasonId: config.seasonId,
      homeTeam: getTeamRef(homeId, allTeams),
      awayTeam: getTeamRef(awayId, allTeams),
      homeScore: g.homeScore,
      awayScore: g.awayScore,
      status: "FINAL",
      quarterOrSet: 4,
      timeRemaining: null,
      startTime: parseGameDate(g.date),
      venue: g.venue,
      playByPlay: [],
      boxScore: { home: g.homeBox, away: g.awayBox },
    });
  }

  importedGames.sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const importedPlayers: Player[] = [];
  for (const agg of playerAgg.values()) {
    const g = agg.games || 1;
    agg.player.seasonAverages = {
      ppg: Math.round((agg.totals.pts / g) * 10) / 10,
      rpg: Math.round((agg.totals.reb / g) * 10) / 10,
      apg: Math.round((agg.totals.ast / g) * 10) / 10,
      spg: Math.round((agg.totals.stl / g) * 10) / 10,
      bpg: Math.round((agg.totals.blk / g) * 10) / 10,
      fgPct: Math.round((agg.totals.fgPct / g) * 10) / 10,
      threePtPct: Math.round((agg.totals.threePtPct / g) * 10) / 10,
      ftPct: Math.round((agg.totals.ftPct / g) * 10) / 10,
    };
    importedPlayers.push(agg.player);
  }

  importedPlayers.sort((a, b) => a.name.localeCompare(b.name));

  const records = new Map<string, { wins: number; losses: number }>();
  for (const game of importedGames) {
    for (const team of [game.homeTeam, game.awayTeam]) {
      if (!records.has(team.id)) records.set(team.id, { wins: 0, losses: 0 });
    }
    const homeWon = game.homeScore > game.awayScore;
    const homeRec = records.get(game.homeTeam.id)!;
    const awayRec = records.get(game.awayTeam.id)!;
    if (homeWon) {
      homeRec.wins += 1;
      awayRec.losses += 1;
    } else {
      awayRec.wins += 1;
      homeRec.losses += 1;
    }
  }

  fs.mkdirSync(path.dirname(config.outPath), { recursive: true });
  fs.writeFileSync(
    config.outPath,
    JSON.stringify(
      {
        seasonId: config.seasonId,
        label: config.label,
        games: importedGames,
        players: importedPlayers,
        teamRecords: Object.fromEntries(records),
        meta: {
          gameCount: importedGames.length,
          playerCount: importedPlayers.length,
          source: config.sourcePath,
        },
      },
      null,
      2
    )
  );

  return {
    gameCount: importedGames.length,
    playerCount: importedPlayers.length,
  };
}
