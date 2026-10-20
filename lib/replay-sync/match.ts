import type { League, ReplayKind } from "@/types/sports";

export type ReplayTeam = { id: string; name: string; short_name: string };
export type ReplayGame = {
  id: string; league: League; season_id: string; season_label: string; status: string; start_time: string;
  home_team_id: string; away_team_id: string; home_score: number; away_score: number;
  home: ReplayTeam; away: ReplayTeam;
};
export type ReplayChannel = { league: League; channel_id: string; label: string; enabled: boolean; league_specific: boolean };
export type ReplayVideo = {
  id: string; title: string; description: string; channelId: string; channelTitle: string;
  publishedAt: string; durationSeconds: number; public: boolean; embeddable: boolean; live: boolean;
};
export type ReplayMatch = { game: ReplayGame; video: ReplayVideo; channel: ReplayChannel; score: number; reasons: string[]; kind: ReplayKind; kindReason: string };

export const REPLAY_TEAM_ALIASES: Record<League, string[][]> = {
  UAAP: [
    ["UST", "University of Santo Tomas", "Santo Tomas", "Growling Tigers", "Golden Tigresses"],
    ["DLSU", "De La Salle University", "La Salle", "Green Archers", "Lady Spikers"],
    ["UP", "University of the Philippines", "UP Fighting Maroons", "Maroons"],
    ["ADMU", "Ateneo", "Ateneo de Manila University", "Blue Eagles"],
    ["ADU", "Adamson", "Adamson University", "Soaring Falcons", "Lady Falcons"],
    ["FEU", "Far Eastern University", "Tamaraws", "Lady Tamaraws"],
    ["NU", "National University", "NU Bulldogs", "Lady Bulldogs"],
    ["UE", "University of the East", "Red Warriors", "Lady Warriors"],
  ],
  PBA: [
    ["GIN", "Ginebra", "Barangay Ginebra", "Barangay Ginebra San Miguel"],
    ["SMB", "San Miguel", "San Miguel Beermen"], ["TNT", "TNT Tropang 5G", "Tropang Giga"],
    ["ROS", "Rain or Shine", "Rain or Shine Elasto Painters"], ["MER", "Meralco", "Meralco Bolts"],
    ["MAG", "Magnolia", "Magnolia Hotshots", "Magnolia Chicken Timplados Hotshots"],
    ["NLX", "NLEX", "NLEX Road Warriors"], ["PHX", "Phoenix", "Phoenix Fuel Masters", "Phoenix Super LPG Fuel Masters"],
    ["BWB", "BLK", "Blackwater", "Blackwater Bossing"], ["CON", "CFX", "Converge", "Converge FiberXers"],
    ["TER", "TERRA", "Terrafirma", "Terrafirma Dyip"], ["TGR", "Titan Ultra", "Titan Ultra Giant Risers"],
    ["MGP", "Macau Giant Pandas"], ["MBK", "Macau Black Bears"],
  ],
  PVL: [
    ["CCS", "CREAM", "Creamline", "Creamline Cool Smashers"], ["HSH", "PLDT", "PLDT High Speed Hitters"],
    ["AKA", "Akari", "Akari Chargers", "Akari Power Chargers"], ["CAP", "CAP1", "Capital1", "Capital 1", "Capital1 Solar Spikers"],
    ["CMF", "Choco Mucho", "Choco Mucho Flying Titans"], ["FFF", "Farm Fresh", "Farm Fresh Foxies"],
    ["GTH", "Galeries", "Galeries Tower", "Galeries Tower Highrisers"], ["NXL", "Nxled", "Nxled Chameleons"],
    ["ZUS", "Zus Coffee", "Zus Coffee Thunderbelles"], ["PET", "PGA", "Petro Gazz", "Petro Gazz Angels"],
    ["CIG", "Cignal", "Cignal HD Spikers"], ["CHO", "Chery Tiggo", "Chery Tiggo Crossovers"],
    ["F2", "F2 Logistics", "F2 Logistics Cargo Movers"], ["FOTON", "Foton Tornadoes"],
    ["ARMY", "Army Black Mamba", "Army Black Mamba Lady Troopers"], ["SLR", "Sta Lucia", "Sta. Lucia Lady Realtors"],
    ["BLP", "BaliPure", "BaliPure Purest Water Defenders"], ["PRL", "Perlas", "Perlas Spikers"],
    ["KWT", "KingWhale", "KingWhale Taipei"], ["KUR", "Kurashiki", "Kurashiki Ablaze"],
    ["GER", "Gerflor", "Quezon City Gerflor Defenders"], ["SGA", "Strong Group", "Strong Group Athletics"],
    ["KOBE", "Kobe Shinwa", "Kobe Shinwa University"], ["EST", "EST Cola"],
  ],
};
const normalize = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const contains = (value: string, phrase: string) => !!phrase && (` ${value} `).includes(` ${phrase} `);

export function teamAliases(team: ReplayTeam, league: League): string[] {
  const own = [team.name, team.short_name].map(normalize).filter(Boolean);
  const group = REPLAY_TEAM_ALIASES[league].find(g => g.some(a => own.includes(normalize(a))));
  return [...new Set([...own, ...(group ?? []).map(normalize)])];
}

export function inferReplayKind(title: string, duration: number): { kind: ReplayKind; reason: string } {
  if (/\bcondensed\b/i.test(title)) return { kind: "condensed", reason: "Title identifies a condensed game." };
  if (/\b(full\s*(game|match)|replay)\b/i.test(title)) return { kind: "full", reason: "Title identifies a full game or replay." };
  if (/\bhighlights?\b/i.test(title)) return { kind: "highlights", reason: "Title identifies highlights." };
  if (duration > 45 * 60) return { kind: "full", reason: "Video runs longer than 45 minutes." };
  if (duration < 15 * 60) return { kind: "highlights", reason: "Video runs less than 15 minutes." };
  return { kind: "highlights", reason: "No explicit replay type; defaults to highlights for review." };
}

export function gameSnapshot(g: ReplayGame) {
  return { status: g.status, league: g.league, season_id: g.season_id, home_team_id: g.home_team_id,
    away_team_id: g.away_team_id, home_score: g.home_score, away_score: g.away_score, start_time: new Date(g.start_time).toISOString() };
}

export function scoreReplay(game: ReplayGame, video: ReplayVideo, channel: ReplayChannel): ReplayMatch | null {
  if (!channel.enabled || channel.league !== game.league || video.channelId !== channel.channel_id ||
    !video.public || !video.embeddable || video.live || video.durationSeconds <= 0 || game.status !== "FINAL" ||
    game.home_score === game.away_score || game.home_score < 0 || game.away_score < 0) return null;
  // Interviews, previews and promotional clips are not game replays.
  if (/\b(preview|interview|reaction|practice|training|teaser|promo|press conference)\b/i.test(video.title)) return null;
  if (/\b(?:[1-5](?:st|nd|rd|th)?\s+(?:set|quarter)|(?:set|quarter)\s*[1-5]|q[1-4])\b.*\bhighlights?\b/i.test(video.title)) return null;
  const elapsed = Date.parse(video.publishedAt) - Date.parse(game.start_time);
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > 72 * 3600000) return null;
  const title = normalize(video.title), description = normalize(video.description);
  if (/\bu\s?16\b|under.?16/i.test(game.season_label) && !/\bu\s?16\b|under.?16|junior high/i.test(video.title + " " + video.description)) return null;
  if (/basketball/i.test(game.season_label) && /volleyball/i.test(video.title)) return null;
  const home = teamAliases(game.home, game.league), away = teamAliases(game.away, game.league);
  const homeTitle = home.some(a => contains(title, a)), awayTitle = away.some(a => contains(title, a));
  if (!home.some(a => contains(title, a) || contains(description, a)) || !away.some(a => contains(title, a) || contains(description, a))) return null;
  // Ginebra's full name contains "San Miguel". A single name cannot identify
  // BOTH clubs: demand separate title/description mentions after removing it.
  const sanMiguel = [game.home, game.away].find(t => /^(SMB|San Miguel Beermen)$/i.test(t.short_name) || t.name === "San Miguel Beermen");
  if (game.league === "PBA" && /ginebra/i.test(title + description) && sanMiguel) {
    const withoutGinebra = normalize((video.title + " " + video.description).replace(/(?:barangay\s+)?ginebra(?:\s+san\s+miguel)?/gi, " "));
    if (!teamAliases(sanMiguel, "PBA").some(a => contains(withoutGinebra, a))) return null;
  }
  const leagueMention = contains(title + " " + description, normalize(game.league)) ||
    contains(title + " " + description, normalize(game.season_label));
  if (!channel.league_specific && !leagueMention) return null;
  const scoreText = video.title.replace(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g, "");
  const scores = [...scoreText.matchAll(/\b(\d{1,3})\s*[-–:]\s*(\d{1,3})\b/g)];
  if (scores.some(m => !((+m[1] === game.home_score && +m[2] === game.away_score) ||
    (+m[2] === game.home_score && +m[1] === game.away_score)))) return null;
  const inferred = inferReplayKind(video.title, video.durationSeconds);
  const score = Math.round(((homeTitle && awayTitle ? 0.6 : 0.4) + 0.15 + 0.1 + (scores.length ? 0.15 : elapsed <= 36 * 3600000 ? 0.1 : 0.05)) * 100) / 100;
  return { game, video, channel, score, kind: inferred.kind, kindReason: inferred.reason, reasons: [
    `Both teams found${homeTitle && awayTitle ? " in the title" : " in the title or description"}.`,
    `Published ${Math.round(elapsed / 3600000)} hours after tip-off.`,
    leagueMention ? "League or season identified." : "Channel is configured as league-specific.",
    ...(scores.length ? ["Title score matches the final result."] : []), "Uploader is on the league's official allowlist.",
  ] };
}

/** All previous statuses, including rejected, are permanent pair exclusions. */
export function canSuggestVideo(gameId: string, videoId: string, previous: { game_id: string; video_id: string }[]) {
  return !previous.some(p => p.game_id === gameId && p.video_id === videoId);
}

/** A video tied between games is withheld; never break ties by row order. */
export function chooseVideoMatch(matches: ReplayMatch[]): { match: ReplayMatch | null; ambiguous: boolean } {
  const ranked = [...matches].filter(m => m.score >= 0.6).sort((a, b) => b.score - a.score);
  if (!ranked.length) return { match: null, ambiguous: false };
  if (ranked[1] && ranked[0].game.id !== ranked[1].game.id && ranked[0].score === ranked[1].score) return { match: null, ambiguous: true };
  return { match: ranked[0], ambiguous: false };
}

export function youtubeVideoId(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const id = url.hostname === "youtu.be" ? url.pathname.slice(1) :
      ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)
        ? url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)$/)?.[1] : null;
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
