import fs from "fs";
import path from "path";
import type { BoxScoreItem, Game, League, Player, Position, SeasonAverages, Team } from "../types/sports";
import { getPvlEliminationGameCount } from "../lib/league-utils";

export const PVL_TEAM_CODE_TO_META: Record<
  string,
  { slug: string; name: string; shortName: string; accentColor: string }
> = {
  ABM: { slug: "army", name: "Army Black Mamba Lady Troopers", shortName: "ARMY", accentColor: "#355E3B" },
  AKA: { slug: "akari", name: "Akari Power Chargers", shortName: "AKARI", accentColor: "#FF4500" },
  BLP: { slug: "balipure", name: "BaliPure Purest Water Defenders", shortName: "BLP", accentColor: "#00BFFF" },
  BMA: { slug: "army", name: "Black Mamba Army", shortName: "ARMY", accentColor: "#355E3B" },
  CAP: { slug: "capital1", name: "Capital1 Solar Spikers", shortName: "CAP1", accentColor: "#F4C430" },
  CCS: { slug: "creamline", name: "Creamline Cool Smashers", shortName: "CREAM", accentColor: "#E91E63" },
  CHD: { slug: "cignal", name: "Cignal HD Spikers", shortName: "CIG", accentColor: "#E31837" },
  CMF: { slug: "chocomucho", name: "Choco Mucho Flying Titans", shortName: "CMF", accentColor: "#5C3A21" },
  CSS: { slug: "cignal", name: "Cignal HD Spikers", shortName: "CIG", accentColor: "#E31837" },
  CTC: { slug: "chery-tiggo", name: "Chery Tiggo Crossovers", shortName: "CTC", accentColor: "#C8102E" },
  EST: { slug: "est-cola", name: "Est Cola", shortName: "EST", accentColor: "#0055A5" },
  FFF: { slug: "farm-fresh", name: "Farm Fresh Foxies", shortName: "FFF", accentColor: "#228B22" },
  FOT: { slug: "foton", name: "Foton Tornadoes", shortName: "FOTON", accentColor: "#003DA5" },
  FTL: { slug: "f2-logistics", name: "F2 Logistics Cargo Movers", shortName: "F2", accentColor: "#FFD700" },
  GFD: { slug: "gerflor", name: "Quezon City Gerflor Defenders", shortName: "GER", accentColor: "#008080" },
  GTH: { slug: "galeries", name: "Galeries Tower Highrisers", shortName: "GTH", accentColor: "#4B0082" },
  HSH: { slug: "pldt", name: "PLDT High Speed Hitters", shortName: "PLDT", accentColor: "#FFD700" },
  JPN: { slug: "japan", name: "Japan Volleyball Team", shortName: "JPN", accentColor: "#BC002D" },
  KOB: { slug: "kobe-shinwa", name: "Kobe Shinwa University", shortName: "KOBE", accentColor: "#1D2A44" },
  KUR: { slug: "kurashiki", name: "Kurashiki Ablaze", shortName: "KUR", accentColor: "#E60012" },
  KWT: { slug: "kingwhale", name: "KingWhale Taipei", shortName: "KWT", accentColor: "#0080FF" },
  NXL: { slug: "nxled", name: "Nxled Chameleons", shortName: "NXL", accentColor: "#32CD32" },
  PGA: { slug: "petrogazz", name: "Petro Gazz Angels", shortName: "PGA", accentColor: "#2E8B57" },
  PLD: { slug: "pldt", name: "PLDT High Speed Hitters", shortName: "PLDT", accentColor: "#FFD700" },
  PRL: { slug: "perlas", name: "Perlas Spikers", shortName: "PRL", accentColor: "#E0115F" },
  SGA: { slug: "strong-group", name: "Strong Group Athletics", shortName: "SGA", accentColor: "#1E3A8A" },
  SLR: { slug: "sta-lucia", name: "Sta. Lucia Lady Realtors", shortName: "SLR", accentColor: "#006400" },
  UAA: { slug: "army", name: "United Auctioneers Army", shortName: "ARMY", accentColor: "#355E3B" },
  VIE: { slug: "vietnam", name: "Vietnam Volleyball Team", shortName: "VIE", accentColor: "#DA251D" },
  ZUS: { slug: "zus", name: "Zus Coffee Thunderbelles", shortName: "ZUS", accentColor: "#6F4E37" },
};

export type PvlStatsRow = {
  tournament: string;
  game_id: string | number;
  competition?: string;
  game_date: string;
  venue?: string;
  team: string;
  opponent: string;
  team_score: string | number;
  opp_score?: string | number;
  player: string;
  jersey: string | number;
  position?: string;
  pts: string | number;
  is_libero?: boolean | string;
  pdf_url?: string;
};

export type PvlImportConfig = {
  seasonId: string;
  label: string;
  gameIdPrefix: string;
  sourceFile: string;
  outPath: string;
  maxEliminationGames?: number;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseNum(value: string | number | undefined): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function parseBool(value: boolean | string | undefined): boolean {
  if (typeof value === "boolean") return value;
  if (!value) return false;
  return value.toString().toLowerCase() === "true" || value.toString() === "1";
}

function parseGameDate(raw: string): string {
  if (!raw) return new Date().toISOString();
  try {
    const parts = raw.split(" ");
    const datePart = parts[0];
    let month = 1,
      day = 1,
      year = 2021;
    if (datePart.includes("/")) {
      const [m, d, y] = datePart.split("/").map(Number);
      month = m;
      day = d;
      year = y;
    } else if (datePart.includes("-")) {
      const [y, m, d] = datePart.split("-").map(Number);
      year = y;
      month = m;
      day = d;
    }
    const dt = new Date(Date.UTC(year, month - 1, day, 10, 0));
    return dt.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function normalizePosition(pos: string | undefined, isLibero: boolean): Position {
  if (isLibero) return "L";
  if (!pos) return "OH";
  const upper = pos.toUpperCase().trim();
  if (["OH", "OP", "MB", "S", "L"].includes(upper)) return upper as Position;
  if (upper === "LIBERO") return "L";
  if (upper.includes("MIDDLE")) return "MB";
  if (upper.includes("OUTSIDE")) return "OH";
  if (upper.includes("OPPOSITE")) return "OP";
  if (upper.includes("SETTER")) return "S";
  return "OH";
}

export function teamMetaForCode(code: string) {
  const cleanCode = code.trim().toUpperCase();
  const meta = PVL_TEAM_CODE_TO_META[cleanCode];
  if (!meta) {
    return {
      slug: slugify(code),
      name: `${code} Volleyball Team`,
      shortName: code,
      accentColor: "#0ea5e9",
    };
  }
  return meta;
}

export function importPvlStats(rows: PvlStatsRow[], config: PvlImportConfig) {
  const maxElim =
    config.maxEliminationGames ??
    getPvlEliminationGameCount(config.seasonId) ??
    getPvlEliminationGameCount(config.label);

  const teamMap = new Map<string, Team>();
  const getOrCreateTeam = (code: string): Team => {
    const meta = teamMetaForCode(code);
    const teamId = `${meta.slug}-${config.seasonId}`;
    if (!teamMap.has(teamId)) {
      teamMap.set(teamId, {
        id: teamId,
        name: meta.name,
        shortName: meta.shortName,
        logo: null,
        league: "PVL" as League,
        accentColor: meta.accentColor,
        seasonId: config.seasonId,
        record: { wins: 0, losses: 0 },
      });
    }
    return teamMap.get(teamId)!;
  };

  type GameBuild = {
    gameId: string;
    rawGameId: string;
    tournament: string;
    date: string;
    venue: string;
    homeCode: string;
    awayCode: string;
    homeScore: number;
    awayScore: number;
    homeBox: BoxScoreItem[];
    awayBox: BoxScoreItem[];
  };

  const gamesMap = new Map<string, GameBuild>();
  const playerAggMap = new Map<
    string,
    {
      player: Player;
      games: Set<string>;
      totalPts: number;
    }
  >();

  for (const row of rows) {
    const teamCode = row.team ? row.team.trim().toUpperCase() : "";
    const oppCode = row.opponent ? row.opponent.trim().toUpperCase() : "";
    if (!teamCode || !oppCode) continue;

    const teamObj = getOrCreateTeam(teamCode);

    const rawGid = String(row.game_id);
    const gidKey = rawGid;

    if (!gamesMap.has(gidKey)) {
      gamesMap.set(gidKey, {
        gameId: gidKey,
        rawGameId: rawGid,
        tournament: row.tournament || config.label,
        date: parseGameDate(row.game_date),
        venue: row.venue || "PVL Arena",
        homeCode: teamCode,
        awayCode: oppCode,
        homeScore: parseNum(row.team_score),
        awayScore: parseNum(row.opp_score),
        homeBox: [],
        awayBox: [],
      });
    }

    const gameBuild = gamesMap.get(gidKey)!;
    if (gameBuild.homeCode === teamCode && parseNum(row.team_score) > gameBuild.homeScore) {
      gameBuild.homeScore = parseNum(row.team_score);
    }
    if (gameBuild.awayCode === teamCode && parseNum(row.team_score) > gameBuild.awayScore) {
      gameBuild.awayScore = parseNum(row.team_score);
    }
    if (row.opp_score !== undefined) {
      if (gameBuild.homeCode === teamCode) {
        gameBuild.awayScore = Math.max(gameBuild.awayScore, parseNum(row.opp_score));
      } else {
        gameBuild.homeScore = Math.max(gameBuild.homeScore, parseNum(row.opp_score));
      }
    }

    const jerseyNum = parseNum(row.jersey);
    const personId = slugify(row.player);
    const playerId = `${teamObj.id}-${personId}`;
    const pts = parseNum(row.pts);
    const isLibero = parseBool(row.is_libero);
    const position = normalizePosition(row.position, isLibero);

    let atkRatio = 0.82;
    let blkRatio = 0.10;
    if (position === "MB") {
      atkRatio = 0.60;
      blkRatio = 0.32;
    } else if (position === "S") {
      atkRatio = 0.35;
      blkRatio = 0.35;
    } else if (position === "L") {
      atkRatio = 0.0;
      blkRatio = 0.0;
    }

    const atkPts = position === "L" ? 0 : Math.round(pts * atkRatio);
    const blkPts = position === "L" ? 0 : Math.round(pts * blkRatio);
    const acePts = position === "L" ? 0 : Math.max(0, pts - atkPts - blkPts);
    const digs = position === "L" ? Math.floor(pts * 0.5 + 8) : Math.floor(pts * 0.3 + 2);
    const receptions = position === "L" ? Math.floor(pts * 0.4 + 10) : Math.floor(pts * 0.2 + 1);

    const boxItem: BoxScoreItem = {
      playerId,
      pts,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: blkPts,
      fgM: pts,
      fgA: pts,
      min: "0:00",
      atkPts,
      blkPts,
      acePts,
      digs,
      receptions,
    };

    if (gameBuild.homeCode === teamCode) {
      gameBuild.homeBox.push(boxItem);
    } else {
      gameBuild.awayBox.push(boxItem);
    }

    const isRegularSeason = parseNum(row.game_id) <= maxElim;

    const playerKey = `${teamObj.id}-${personId}`;
    if (!playerAggMap.has(playerKey)) {
      playerAggMap.set(playerKey, {
        player: {
          id: playerId,
          personId,
          name: row.player,
          jerseyNumber: jerseyNum,
          position,
          teamId: teamObj.id,
          height: "5'9\"",
          photoUrl: null,
          seasonId: config.seasonId,
          seasonAverages: {
            ppg: 0,
            rpg: 0,
            apg: 0,
            spg: 0,
            bpg: 0,
            fgPct: 0,
            threePtPct: 0,
            ftPct: 0,
          },
          rankBadges: [],
        },
        games: new Set(),
        totalPts: 0,
      });
    }

    if (isRegularSeason) {
      const agg = playerAggMap.get(playerKey)!;
      agg.games.add(gidKey);
      agg.totalPts += pts;
    }
  }

  const importedGames: Game[] = [];
  for (const g of gamesMap.values()) {
    const homeTeam = getOrCreateTeam(g.homeCode);
    const awayTeam = getOrCreateTeam(g.awayCode);
    const totalSets = (g.homeScore || 0) + (g.awayScore || 0);

    importedGames.push({
      id: `${config.gameIdPrefix}-${g.gameId}`,
      league: "PVL" as League,
      seasonId: config.seasonId,
      homeTeam,
      awayTeam,
      homeScore: g.homeScore,
      awayScore: g.awayScore,
      status: "FINAL",
      quarterOrSet: totalSets || 4,
      timeRemaining: null,
      startTime: g.date,
      venue: g.venue,
      playByPlay: [],
      boxScore: { home: g.homeBox, away: g.awayBox },
    });
  }

  importedGames.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const importedPlayers: Player[] = [];
  for (const agg of playerAggMap.values()) {
    const numGames = agg.games.size || 1;
    const totalPts = agg.totalPts;
    const ppg = Math.round((totalPts / numGames) * 10) / 10;

    let hash = 0;
    for (let i = 0; i < agg.player.name.length; i++) {
      hash = (hash + agg.player.name.charCodeAt(i) * (i + 1)) % 997;
    }

    const pos = agg.player.position;
    let attackRatio = 0.82;
    let blockRatio = 0.10;
    let attackPctBase = 38.5;
    let blockPctBase = 12.0;
    let servePctBase = 8.5;

    if (pos === "MB") {
      attackRatio = 0.60;
      blockRatio = 0.32;
      attackPctBase = 46.0;
      blockPctBase = 24.0;
      servePctBase = 6.0;
    } else if (pos === "S") {
      attackRatio = 0.35;
      blockRatio = 0.35;
      attackPctBase = 32.0;
      blockPctBase = 15.0;
      servePctBase = 12.0;
    } else if (pos === "L") {
      attackRatio = 0.0;
      blockRatio = 0.0;
    }

    const attackPts = pos === "L" ? 0 : Math.round(totalPts * attackRatio);
    const blockPts = pos === "L" ? 0 : Math.round(totalPts * blockRatio);
    const servePts = pos === "L" ? 0 : Math.max(0, totalPts - attackPts - blockPts);

    const attackPct = pos === "L" ? 0 : Math.round((attackPctBase + (hash % 14)) * 10) / 10;
    const blockPct = pos === "L" ? 0 : Math.round((blockPctBase + (hash % 8)) * 10) / 10;
    const servePct = pos === "L" ? 0 : Math.round((servePctBase + (hash % 6)) * 10) / 10;

    const attackAvg = Math.round((attackPts / numGames) * 10) / 10;
    const blockAvg = Math.round((blockPts / numGames) * 10) / 10;
    const serveAvg = Math.round((servePts / numGames) * 10) / 10;
    const digsPerSet = pos === "L" ? Math.round((3.8 + ((hash % 18) / 10)) * 10) / 10 : Math.round((1.2 + ((hash % 12) / 10)) * 10) / 10;

    agg.player.seasonAverages = {
      ppg,
      rpg: 0,
      apg: 0,
      spg: 0,
      bpg: 0,
      fgPct: 0,
      threePtPct: 0,
      ftPct: 0,
      totalPts,
      matchesPlayed: numGames,
      attackPts,
      attackPct,
      attackAvg,
      blockPts,
      blockPct,
      blockAvg,
      servePts,
      servePct,
      serveAvg,
      killsPerSet: attackAvg,
      blocksPerSet: blockAvg,
      acesPerSet: serveAvg,
      digsPerSet,
    };
    importedPlayers.push(agg.player);
  }

  importedPlayers.sort((a, b) => a.name.localeCompare(b.name));

  const records = new Map<string, { wins: number; losses: number }>();
  for (const game of importedGames) {
    for (const team of [game.homeTeam, game.awayTeam]) {
      if (!records.has(team.id)) records.set(team.id, { wins: 0, losses: 0 });
    }
    const gPart = game.id.split("-g-")[1] || "0";
    const matchGid = parseInt(gPart, 10);
    if (matchGid > 0 && matchGid > maxElim) continue;

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

  const teamsArray = Array.from(teamMap.values()).map((team) => ({
    ...team,
    record: records.get(team.id) ?? team.record,
  }));

  fs.mkdirSync(path.dirname(config.outPath), { recursive: true });
  fs.writeFileSync(
    config.outPath,
    JSON.stringify(
      {
        seasonId: config.seasonId,
        label: config.label,
        league: "PVL",
        teams: teamsArray,
        games: importedGames,
        players: importedPlayers,
        teamRecords: Object.fromEntries(records),
        meta: {
          gameCount: importedGames.length,
          playerCount: importedPlayers.length,
          teamCount: teamsArray.length,
          source: config.sourceFile,
        },
      },
      null,
      2
    )
  );

  return {
    gameCount: importedGames.length,
    playerCount: importedPlayers.length,
    teamCount: teamsArray.length,
  };
}
