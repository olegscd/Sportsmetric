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
  CTC: { slug: "chery-tiggo", name: "Chery Tiggo Crossovers", shortName: "CHERY", accentColor: "#C8102E" },
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
    if (year < 100) {
      year = 2000 + year;
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

    const boxItem: BoxScoreItem = {
      playerId,
      pts,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      fgM: pts,
      fgA: pts,
      min: "0:00",
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

    const agg = playerAggMap.get(playerKey)!;
    if (jerseyNum > 0 && (!agg.player.jerseyNumber || agg.player.jerseyNumber === 0)) {
      agg.player.jerseyNumber = jerseyNum;
    }

    if (isRegularSeason) {
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

let pvlOfficialPlayerStatsData: Record<string, any> | null = null;

function getOfficialRecord(slugOrPersonId: string, name?: string) {
  if (!pvlOfficialPlayerStatsData) {
    const jsonPath = path.resolve("scripts/generated/pvl-official-player-stats.json");
    if (fs.existsSync(jsonPath)) {
      pvlOfficialPlayerStatsData = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    }
  }
  if (!pvlOfficialPlayerStatsData) return null;
  const slug = slugOrPersonId.toLowerCase();
  if (pvlOfficialPlayerStatsData[slug]) return pvlOfficialPlayerStatsData[slug];
  if (name) {
    const nameSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (pvlOfficialPlayerStatsData[nameSlug]) return pvlOfficialPlayerStatsData[nameSlug];
  }
  const foundKey = Object.keys(pvlOfficialPlayerStatsData).find(
    (k) => slug.endsWith(k) || k.endsWith(slug)
  );
  return foundKey ? pvlOfficialPlayerStatsData[foundKey] : null;
}

  const importedPlayers: Player[] = [];
  for (const agg of playerAggMap.values()) {
    const numGames = agg.games.size || 0;
    const totalPts = agg.totalPts;
    const ppg = numGames > 0 ? Math.round((totalPts / numGames) * 10) / 10 : 0;

    const officialRec = getOfficialRecord(agg.player.personId, agg.player.name);

    if (officialRec) {
      if (officialRec.position) {
        agg.player.position = normalizePosition(officialRec.position, officialRec.position === "L");
      }
      if (officialRec.height) {
        agg.player.height = officialRec.height;
      }
      if (officialRec.jersey && officialRec.jersey > 0) {
        agg.player.jerseyNumber = officialRec.jersey;
      }

      const confStat =
        officialRec.conferences?.find((c: any) => {
          if (!c.conferenceName) return false;
          const cName = c.conferenceName.toLowerCase();
          const sLabel = config.label.toLowerCase();
          const sId = config.seasonId.toLowerCase();
          return (
            sLabel.includes(cName) ||
            cName.includes(sId.replace("pvl-", "")) ||
            (sId.includes("2021") && cName.includes("2021")) ||
            (sId.includes("2022-open") && cName.includes("2022 open")) ||
            (sId.includes("2022-invitational") && cName.includes("2022 invitational")) ||
            (sId.includes("2022-reinforced") && cName.includes("2022 reinforced"))
          );
        }) || officialRec.career;

      if (confStat) {
        agg.player.seasonAverages = {
          ppg: confStat.avgPerSet || ppg,
          rpg: 0,
          apg: 0,
          spg: 0,
          bpg: 0,
          fgPct: confStat.efficiencyAtk || 0,
          threePtPct: 0,
          ftPct: 0,
          totalPts: confStat.totalPoints || totalPts,
          matchesPlayed: numGames,
          setsPlayed: confStat.setsPlayed || numGames * 3,
          avgPerSet: confStat.avgPerSet || 0,
          ptsAtk: confStat.ptsAtk || 0,
          ptsBlk: confStat.ptsBlk || 0,
          ptsAce: confStat.ptsAce || 0,
          exeSet: confStat.exeSet || 0,
          exeDig: confStat.exeDig || 0,
          exeRec: confStat.exeRec || 0,
          faultAtk: confStat.faultAtk || 0,
          faultBlk: confStat.faultBlk || 0,
          faultSrv: confStat.faultSrv || 0,
          faultSet: confStat.faultSet || 0,
          faultDig: confStat.faultDig || 0,
          faultRec: confStat.faultRec || 0,
          totalAtk: confStat.totalAtk || 0,
          totalBlk: confStat.totalBlk || 0,
          totalAce: confStat.totalAce || 0,
          totalSet: confStat.totalSet || 0,
          totalDig: confStat.totalDig || 0,
          totalRec: confStat.totalRec || 0,
          avgAtk: confStat.avgAtk || 0,
          avgBlk: confStat.avgBlk || 0,
          avgAce: confStat.avgAce || 0,
          avgSet: confStat.avgSet || 0,
          avgDig: confStat.avgDig || 0,
          avgRec: confStat.avgRec || 0,
          successAtk: confStat.successAtk || 0,
          successBlk: confStat.successBlk || 0,
          successAce: confStat.successAce || 0,
          successSet: confStat.successSet || 0,
          successDig: confStat.successDig || 0,
          successRec: confStat.successRec || 0,
          efficiencyAtk: confStat.efficiencyAtk || 0,
          efficiencyBlk: confStat.efficiencyBlk || 0,
          efficiencyAce: confStat.efficiencyAce || 0,
          efficiencySet: confStat.efficiencySet || 0,
          efficiencyDig: confStat.efficiencyDig || 0,
          efficiencyRec: confStat.efficiencyRec || 0,
          attackPts: confStat.ptsAtk || 0,
          attackPct: confStat.efficiencyAtk || 0,
          attackAvg: confStat.avgAtk || 0,
          blockPts: confStat.ptsBlk || 0,
          blockPct: confStat.successBlk || 0,
          blockAvg: confStat.avgBlk || 0,
          servePts: confStat.ptsAce || 0,
          servePct: confStat.successAce || 0,
          serveAvg: confStat.avgAce || 0,
        };
      } else {
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
          killsPerSet: ppg,
        };
      }
    } else {
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
        killsPerSet: ppg,
      };
    }

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
