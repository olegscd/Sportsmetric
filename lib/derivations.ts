import type { BoxScoreItem, Game, League, Player, SeasonAverages, Team } from "@/types/sports";
import { getPvlEliminationGameCount } from "@/lib/league-utils";

export const LIFETIME_SEASON_ID = "lifetime";

export function isLifetimeSeason(seasonId: string): boolean {
  return seasonId === LIFETIME_SEASON_ID;
}

/**
 * Automatically determines if a game is LIVE, UPCOMING, or FINAL.
 * If a game was scheduled as UPCOMING and its start_time has arrived (within active match window),
 * it dynamically updates to LIVE in real-time.
 */
export function getEffectiveGameStatus(
  game: Pick<Game, "status" | "startTime"> & { league?: League },
  currentTime = Date.now()
): "LIVE" | "UPCOMING" | "FINAL" {
  if (game.status === "FINAL") return "FINAL";
  if (game.status === "LIVE") return "LIVE";

  // For PVL, matches do NOT auto-transition to LIVE based on time (official stats come via PDF post-match)
  if (game.league === "PVL") {
    return "UPCOMING";
  }

  const startMs = new Date(game.startTime).getTime();
  if (Number.isFinite(startMs) && currentTime >= startMs) {
    const elapsedHours = (currentTime - startMs) / (1000 * 60 * 60);
    // Active match window (up to 4.5 hours after tip-off)
    if (elapsedHours >= 0 && elapsedHours < 4.5) {
      return "LIVE";
    }
  }

  return "UPCOMING";
}



export interface DerivedTeamStandings {
  team: Team;
  wins: number;
  losses: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  streak: string;
}

export interface StatLeaderEntry {
  player: Player;
  team: Team;
  value: number;
}

export interface PlayerGameLogEntry {
  game: Game;
  opponent: Team;
  isHome: boolean;
  stat: BoxScoreItem;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Extracts the numeric game sequence number from a game ID (e.g. "uaap-s87-g14" -> 14).
 */
export function extractGameNumber(id: string): number {
  const match = id.match(/g(\d+)$/i) || id.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Determines whether a game is a playoff / post-elimination game.
 * Uses explicit game.isPlayoff / game.stage metadata stored directly in the database.
 */
export function isPlayoffGame(game: Pick<Game, "id" | "league" | "seasonId"> & { stage?: string; isPlayoff?: boolean }): boolean {
  if (game.isPlayoff !== undefined && game.isPlayoff !== null) {
    return game.isPlayoff;
  }
  if (game.stage) {
    return game.stage !== "ELIMINATION";
  }

  const idLower = game.id.toLowerCase();
  return (
    idLower.includes("playoff") ||
    idLower.includes("semis") ||
    idLower.includes("semi") ||
    idLower.includes("finals") ||
    idLower.includes("final") ||
    idLower.includes("qf") ||
    idLower.includes("sf")
  );
}


/**
 * Helper to sort UAAP games strictly by game ID sequence (1..56..62)
 * with a fallback to chronological startTime.
 */
function sortUAAPGames(games: Game[]): Game[] {
  return [...games].sort((a, b) => {
    const numA = extractGameNumber(a.id);
    const numB = extractGameNumber(b.id);
    if (numA !== 0 && numB !== 0 && numA !== numB) {
      return numA - numB;
    }
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });
}

/**
 * Splits UAAP games into Regular Season (Game IDs 1..56 / stage ELIMINATION)
 * and Playoff / Final Four games (Game IDs 57+ / stage SEMIFINALS, FINALS).
 */
export function getUAAPGamePartition(
  games: Game[],
  seasonId: string
): {
  regularSeasonGames: Game[];
  playoffGames: Game[];
} {
  const isLifetime = isLifetimeSeason(seasonId);
  const sortedUAAPGames = sortUAAPGames(
    games.filter((g) => g.league === "UAAP" && (isLifetime || g.seasonId === seasonId))
  );

  return {
    regularSeasonGames: sortedUAAPGames.filter((g) => !isPlayoffGame(g)),
    playoffGames: sortedUAAPGames.filter((g) => isPlayoffGame(g)),
  };
}

/**
 * Filter games for standings & season averages calculations.
 * Excludes playoff / post-season games.
 */
export function getRegularSeasonGames(games: Game[], league: League, seasonId: string): Game[] {
  const isLifetime = isLifetimeSeason(seasonId);
  const leagueGames = games.filter(
    (g) => g.league === league && (isLifetime || g.seasonId === seasonId)
  );

  return leagueGames.filter((g) => !isPlayoffGame(g));
}


/**
 * Dynamically derives League Standings from regular season games in context state.
 * For UAAP, caps at 56 regular season games.
 */
export function deriveStandings(
  teams: Team[],
  games: Game[],
  league: League,
  seasonId: string
): DerivedTeamStandings[] {
  const isLifetime = isLifetimeSeason(seasonId);

  const relevantTeams = isLifetime
    ? collapseTeamsToLifetime(teams.filter((t) => t.league === league))
    : teams.filter((t) => t.league === league && t.seasonId === seasonId);

  const regGames = getRegularSeasonGames(games, league, seasonId);
  const finalGames = regGames.filter((g) => g.status === "FINAL");

  const standingsMap = new Map<string, DerivedTeamStandings>();

  for (const team of relevantTeams) {
    standingsMap.set(team.id, {
      team,
      wins: 0,
      losses: 0,
      winPct: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
      streak: "-",
    });
  }

  function matchesTeam(gameTeam: Team | string, team: Team): boolean {
    const gameTeamId = typeof gameTeam === "string" ? gameTeam : gameTeam.id;
    if (gameTeamId === team.id) return true;

    // Check direct shortName equality if gameTeam object is present
    if (typeof gameTeam !== "string" && gameTeam.shortName && team.shortName) {
      if (
        gameTeam.shortName.toUpperCase() === team.shortName.toUpperCase() &&
        (gameTeam.league === team.league || (!gameTeam.league && !team.league))
      ) {
        return true;
      }
    }

    // Check team registry for shortName & league match
    const match = teams.find((t) => t.id === gameTeamId);
    if (match && match.shortName && team.shortName) {
      if (
        match.shortName.toUpperCase() === team.shortName.toUpperCase() &&
        match.league === team.league
      ) {
        return true;
      }
    }

    // Normalized slug matching for lifetime or multi-season IDs (e.g. 'converge' <-> 'converge-pba-gov-cup-50')
    if (isLifetime) {
      if (gameTeamId.startsWith(team.id + "-") || team.id.startsWith(gameTeamId + "-")) {
        return true;
      }
    }

    return false;
  }


  for (const item of standingsMap.values()) {
    const team = item.team;
    const teamGames = finalGames
      .filter((g) => matchesTeam(g.homeTeam, team) || matchesTeam(g.awayTeam, team))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    let wins = 0;
    let losses = 0;
    let pf = 0;
    let pa = 0;

    for (const g of teamGames) {
      const isHome = matchesTeam(g.homeTeam, team);
      const teamScore = isHome ? g.homeScore : g.awayScore;
      const oppScore = isHome ? g.awayScore : g.homeScore;


      pf += teamScore;
      pa += oppScore;

      if (teamScore > oppScore) {
        wins++;
      } else if (teamScore < oppScore) {
        losses++;
      }
    }

    let streak = "-";
    if (teamGames.length > 0) {
      let count = 0;
      let currentType: "W" | "L" | null = null;

      for (let i = teamGames.length - 1; i >= 0; i--) {
        const g = teamGames[i];
        const isHome = matchesTeam(g.homeTeam.id, team);
        const teamScore = isHome ? g.homeScore : g.awayScore;
        const oppScore = isHome ? g.awayScore : g.homeScore;

        if (teamScore === oppScore) continue;
        const gameResult: "W" | "L" = teamScore > oppScore ? "W" : "L";

        if (currentType === null) {
          currentType = gameResult;
          count = 1;
        } else if (currentType === gameResult) {
          count++;
        } else {
          break;
        }
      }

      if (currentType && count > 0) {
        streak = `${currentType}${count}`;
      }
    }

    const totalGames = wins + losses;
    if (totalGames === 0 && team.record) {
      wins = team.record.wins;
      losses = team.record.losses;
    }
    const derivedTotal = wins + losses;
    item.wins = wins;
    item.losses = losses;
    item.winPct = derivedTotal > 0 ? wins / derivedTotal : 0;
    item.pointsFor = pf;
    item.pointsAgainst = pa;
    item.pointDiff = pf - pa;
    item.streak = streak;

    item.team = {
      ...item.team,
      record: { wins, losses },
    };
  }

  return Array.from(standingsMap.values()).sort((a, b) => {
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return a.team.name.localeCompare(b.team.name);
  });
}

/**
 * Dynamically computes Player Season Averages directly from aggregated box scores in games.
 * For UAAP, strictly counts regular season games up to Game ID 56.
 */
export function derivePlayerAverages(player: Player, games: Game[], teams?: Team[]): SeasonAverages {
  const playerTeam = teams?.find((t) => t.id === player.teamId);
  const league = playerTeam?.league ?? "UAAP";

  const relevantGames = getRegularSeasonGames(games, league, player.seasonId);

  let pts = 0;
  let reb = 0;
  let ast = 0;
  let stl = 0;
  let blk = 0;
  let fgM = 0;
  let fgA = 0;
  let threeM = 0;
  let threeA = 0;
  let ftM = 0;
  let ftA = 0;
  let gp = 0;

  for (const game of relevantGames) {
    const allBoxItems = [...(game.boxScore?.home ?? []), ...(game.boxScore?.away ?? [])];
    const boxItem = allBoxItems.find((b) => b.playerId === player.id);

    if (boxItem) {
      gp++;
      pts += boxItem.pts ?? 0;
      reb += boxItem.reb ?? 0;
      ast += boxItem.ast ?? 0;
      stl += boxItem.stl ?? 0;
      blk += boxItem.blk ?? 0;
      fgM += boxItem.fgM ?? 0;
      fgA += boxItem.fgA ?? 0;
      threeM += boxItem.threeM ?? 0;
      threeA += boxItem.threeA ?? 0;
      ftM += boxItem.ftM ?? 0;
      ftA += boxItem.ftA ?? 0;
    }
  }

  if (gp === 0) {
    return player.seasonAverages;
  }

  return {
    ppg: round1(pts / gp),
    rpg: round1(reb / gp),
    apg: round1(ast / gp),
    spg: round1(stl / gp),
    bpg: round1(blk / gp),
    fgPct: fgA > 0 ? round1((fgM / fgA) * 100) : 0,
    threePtPct: threeA > 0 ? round1((threeM / threeA) * 100) : 0,
    ftPct: ftA > 0 ? round1((ftM / ftA) * 100) : 0,
    totalPts: player.seasonAverages.totalPts ?? pts,
    matchesPlayed: player.seasonAverages.matchesPlayed ?? gp,
    attackPts: player.seasonAverages.attackPts,
    attackPct: player.seasonAverages.attackPct,
    attackAvg: player.seasonAverages.attackAvg,
    blockPts: player.seasonAverages.blockPts,
    blockPct: player.seasonAverages.blockPct,
    blockAvg: player.seasonAverages.blockAvg,
    servePts: player.seasonAverages.servePts,
    servePct: player.seasonAverages.servePct,
    serveAvg: player.seasonAverages.serveAvg,
    killsPerSet: player.seasonAverages.killsPerSet,
    digsPerSet: player.seasonAverages.digsPerSet,
    blocksPerSet: player.seasonAverages.blocksPerSet,
    acesPerSet: player.seasonAverages.acesPerSet,
  };
}

/**
 * Ranks players within a league by dynamically derived season-average stat keys.
 * For UAAP, strictly counts regular season stats up to Game ID 56.
 */
export function deriveStatLeaders(
  players: Player[],
  teams: Team[],
  games: Game[],
  league: League,
  statKey: keyof SeasonAverages,
  seasonId: string,
  limit = 5
): StatLeaderEntry[] {
  const isLifetime = isLifetimeSeason(seasonId);

  const relevantPlayers = isLifetime
    ? collapsePlayersToLifetime(
        players.filter((p) => {
          const team = teams.find((t) => t.id === p.teamId);
          return team?.league === league;
        })
      )
    : players.filter((p) => {
        if (p.seasonId !== seasonId) return false;
        const team = teams.find((t) => t.id === p.teamId);
        return team?.league === league;
      });

  const teamsById = new Map(teams.map((t) => [t.id, t]));

  return relevantPlayers
    .map((player) => {
      const averages = derivePlayerAverages(player, games, teams);
      const team = teamsById.get(player.teamId);
      const value = averages[statKey];
      return team && typeof value === "number"
        ? { player: { ...player, seasonAverages: averages }, team, value }
        : null;
    })
    .filter((entry): entry is StatLeaderEntry => entry !== null && entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/**
 * 1-based rank of a player within their league for a given stat key, derived dynamically.
 */
export function derivePlayerStatRank(
  playerId: string,
  statKey: keyof SeasonAverages,
  players: Player[],
  teams: Team[],
  games: Game[]
): number | undefined {
  const player = players.find((p) => p.id === playerId);
  if (!player) return undefined;

  const team = teams.find((t) => t.id === player.teamId);
  if (!team) return undefined;

  // Pre-compute averages for all league players in one pass
  const leaguePlayers = players.filter((p) => {
    const pTeam = teams.find((t) => t.id === p.teamId);
    return pTeam && pTeam.league === team.league && p.seasonId === player.seasonId;
  });

  const averagesCache = new Map<string, SeasonAverages>();
  for (const p of leaguePlayers) {
    averagesCache.set(p.id, derivePlayerAverages(p, games, teams));
  }

  const playerAvg = averagesCache.get(playerId);
  if (!playerAvg) return undefined;
  const value = playerAvg[statKey];
  if (typeof value !== "number") return undefined;

  const ranked = leaguePlayers
    .map((p) => {
      const avg = averagesCache.get(p.id)!;
      return { id: p.id, value: avg[statKey] };
    })
    .filter((entry): entry is { id: string; value: number } => typeof entry.value === "number")
    .sort((a, b) => b.value - a.value);

  const index = ranked.findIndex((e) => e.id === playerId);
  return index === -1 ? undefined : index + 1;
}

/**
 * Dynamically builds player game logs from games containing box score lines for the player.
 */
export function derivePlayerGameLog(
  playerId: string,
  games: Game[],
  teams: Team[],
  players: Player[]
): PlayerGameLogEntry[] {
  const player = players.find((p) => p.id === playerId);
  if (!player) return [];

  const teamsById = new Map(teams.map((t) => [t.id, t]));

  return games
    .filter((g) => g.seasonId === player.seasonId)
    .flatMap((game) => {
      const inHome = game.boxScore?.home?.find((item) => item.playerId === playerId);
      const inAway = inHome ? undefined : game.boxScore?.away?.find((item) => item.playerId === playerId);
      if (!inHome && !inAway) return [];

      const isHome = Boolean(inHome);
      const stat = (inHome || inAway)!;
      const opponent = isHome ? game.awayTeam : game.homeTeam;
      const fullOpponent = teamsById.get(opponent.id) ?? opponent;

      return [{ game, opponent: fullOpponent, isHome, stat }];
    })
    .sort((a, b) => new Date(b.game.startTime).getTime() - new Date(a.game.startTime).getTime());

}

function collapseTeamsToLifetime(teams: Team[]): Team[] {
  const byKey = new Map<string, Team[]>();
  for (const team of teams) {
    const key = `${team.league}::${team.shortName}`;
    const list = byKey.get(key) ?? [];
    list.push(team);
    byKey.set(key, list);
  }

  return Array.from(byKey.values()).map((rows) => {
    // Sort descending by seasonId so rows[0] is truly the most recent
    rows.sort((a, b) => b.seasonId.localeCompare(a.seasonId));
    const latest = rows[0];
    return {
      ...latest,
      seasonId: LIFETIME_SEASON_ID,
      record: {
        wins: rows.reduce((sum, r) => sum + r.record.wins, 0),
        losses: rows.reduce((sum, r) => sum + r.record.losses, 0),
      },
    };
  });
}

function collapsePlayersToLifetime(players: Player[]): Player[] {
  const byPerson = new Map<string, Player[]>();
  for (const player of players) {
    const list = byPerson.get(player.personId) ?? [];
    list.push(player);
    byPerson.set(player.personId, list);
  }

  return Array.from(byPerson.values()).map((rows) => {
    // Sort descending by seasonId so rows[0] is truly the most recent
    rows.sort((a, b) => b.seasonId.localeCompare(a.seasonId));
    const latest = rows[0];
    return {
      ...latest,
      seasonId: LIFETIME_SEASON_ID,
      rankBadges: [],
    };
  });
}
