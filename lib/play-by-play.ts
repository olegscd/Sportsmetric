import type * as cheerio from "cheerio";
import type { PlayByPlayEvent, PlayByPlayEventType } from "@/types/sports";

/** One LiveStats play, oriented to the box score's first ("home") and second team. */
export interface ExtractedPlay {
  side: "home" | "away" | null;
  period: number;
  /** Game clock as printed, e.g. "08:42". */
  timestamp: string;
  description: string;
  type: PlayByPlayEventType;
  /** Running score after this play, in the same home/away orientation. */
  score: { home: number; away: number };
  scoring: boolean;
}

export const MAX_PLAYS = 1000;
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function playType(kind: string, text: string): PlayByPlayEventType | null {
  switch (kind) {
    case "shot": return /^MISS\b/i.test(text) ? "FG_MISSED" : /\b3PT\b/i.test(text) ? "3PT_MADE" : "FG_MADE";
    case "free_throw": return /\bMADE\b/i.test(text) ? "FT_MADE" : "FT_MISSED";
    case "rebound": return "REBOUND";
    case "turnover": return "TURNOVER";
    case "foul": return "FOUL";
    case "sub": return "SUB";
    case "timeout": return "TIMEOUT";
    case "steal": return "STEAL";
    case "block": return "BLOCK";
    case "assist": return "ASSIST";
    case "period_end": case "end_period": return "PERIOD_END";
    // Jump balls and anything new carry no event type the feed can show.
    default: return null;
  }
}

const clockSeconds = (t: string) => { const m = t.match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1] * 60 + +m[2] : -1; };

/**
 * Reads the LiveStats play-by-play (`#playbyplay .pbpa`). The page lists plays
 * newest first and prints the score ("84 - 69", first team first) only on
 * scoring plays; the result is chronological with the score carried forward.
 * `pbpt1` is the team of the first box score table.
 */
export function parseLiveStatsPlays($: cheerio.CheerioAPI): ExtractedPlay[] {
  const raw: { side: ExtractedPlay["side"]; period: number; timestamp: string; description: string; type: PlayByPlayEventType; score: [number, number] | null }[] = [];
  $("#playbyplay .pbpa").each((_, el) => {
    const row = $(el);
    const classes = (row.attr("class") ?? "").split(/\s+/);
    const kind = classes.find(c => c.startsWith("pbpty"))?.slice(5) ?? "";
    const team = classes.find(c => /^pbpt\d$/.test(c));
    const time = row.find(".time").first();
    const periodText = clean(time.find(".period").text());
    const period = Number(classes.find(c => /^per_p\d+$/.test(c))?.slice(5) ?? periodText.replace(/\D/g, ""));
    const scoreMatch = clean(time.find(".score").text()).match(/^(\d{1,3})\s*-\s*(\d{1,3})$/);
    const clock = time.clone(); clock.find(".period,.score").remove();
    const action = row.find(".action").first().clone(); action.find("strong").remove();
    const description = clean(action.text()).slice(0, 500);
    const type = playType(kind, description);
    if (!type || !Number.isInteger(period) || period < 1 || period > 20 || !description) return;
    raw.push({
      side: team === "pbpt1" ? "home" : team === "pbpt2" ? "away" : null,
      period, timestamp: clean(clock.text()).slice(0, 12), description, type,
      score: scoreMatch ? [+scoreMatch[1], +scoreMatch[2]] : null,
    });
  });
  if (raw.length > 1) {
    // Newest first unless the first row is earlier in the game than the last.
    const first = raw[0], last = raw[raw.length - 1];
    const firstIsLater = first.period > last.period || (first.period === last.period && clockSeconds(first.timestamp) < clockSeconds(last.timestamp));
    if (firstIsLater) raw.reverse();
  }
  let home = 0, away = 0;
  return raw.slice(-MAX_PLAYS).map(play => {
    let scoring = false;
    if (play.score) {
      scoring = play.score[0] !== home || play.score[1] !== away;
      [home, away] = play.score;
    }
    return { side: play.side, period: play.period, timestamp: play.timestamp, description: play.description, type: play.type, score: { home, away }, scoring };
  });
}

/** Reverses the home/away orientation of extracted plays. */
export function swapPlays(plays: readonly ExtractedPlay[]): ExtractedPlay[] {
  return plays.map(p => ({ ...p, side: p.side === "home" ? "away" : p.side === "away" ? "home" : null, score: { home: p.score.away, away: p.score.home } }));
}

/** Stored play-by-play events for a fixture whose teams match the plays' home/away. */
export function toPlayByPlayEvents(plays: readonly ExtractedPlay[] | undefined, homeTeamId: string, awayTeamId: string): PlayByPlayEvent[] {
  return (plays ?? []).slice(-MAX_PLAYS).map((play, index) => ({
    id: "pbp-" + (index + 1),
    timestamp: String(play.timestamp ?? "").slice(0, 12),
    period: Math.min(20, Math.max(0, Math.trunc(Number(play.period) || 0))),
    description: String(play.description ?? "").slice(0, 500),
    scoringTeamId: play.scoring ? (play.side === "home" ? homeTeamId : play.side === "away" ? awayTeamId : null) : null,
    currentScore: { home: Math.max(0, Math.trunc(Number(play.score?.home) || 0)), away: Math.max(0, Math.trunc(Number(play.score?.away) || 0)) },
    type: play.type,
  }));
}
