import type { BoxScoreItem, Player } from "@/types/sports";

export interface ParsedBoxScoreRow {
  raw: string;
  playerId: string;
  playerName: string;
  stat: BoxScoreItem;
}

export interface UnmatchedBoxScoreRow {
  raw: string;
  reason: string;
}

export interface ParseBoxScoreResult {
  matched: ParsedBoxScoreRow[];
  unmatched: UnmatchedBoxScoreRow[];
}

/**
 * Parses pasted, semi-structured box score text into BoxScoreItem rows,
 * matched against a known team roster by name.
 *
 * Expected shape, one player per line (comma, tab, or 2+ spaces between
 * columns -- exact spacing/columns don't matter):
 *
 *   Kevin Quiambao, 32:00, 26, 12, 5, 3, 1, 10-17, 2-5, 4-5
 *   Name            MIN    PTS REB AST STL BLK FG    3PT   FT
 *
 * MIN (mm:ss) and the made-attempted pairs (FG, 3PT, FT, in that order) are
 * recognized by shape and can be omitted; any other plain integers found
 * after the name are read positionally as PTS, REB, AST, STL, BLK.
 */
export function parseBoxScoreText(text: string, roster: Player[]): ParseBoxScoreResult {
  const matched: ParsedBoxScoreRow[] = [];
  const unmatched: UnmatchedBoxScoreRow[] = [];

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const tokens = splitLine(line);

    const nameTokens: string[] = [];
    const valueTokens: string[] = [];
    let inValues = false;
    for (const token of tokens) {
      if (!inValues && !/^\d/.test(token)) {
        nameTokens.push(token);
      } else {
        inValues = true;
        valueTokens.push(token);
      }
    }

    const name = nameTokens.join(" ").trim();
    if (!name) {
      unmatched.push({ raw: line, reason: "Couldn't find a player name on this line" });
      continue;
    }

    const player = findPlayerByName(name, roster);
    if (!player) {
      unmatched.push({ raw: line, reason: `No roster match for "${name}"` });
      continue;
    }

    let min = "-";
    const fgPairs: string[] = [];
    const numbers: number[] = [];

    for (const token of valueTokens) {
      if (/^\d{1,3}:\d{2}$/.test(token)) {
        min = token;
      } else if (/^\d+-\d+$/.test(token)) {
        fgPairs.push(token);
      } else if (/^\d+$/.test(token)) {
        numbers.push(parseInt(token, 10));
      }
    }

    const [pts = 0, reb = 0, ast = 0, stl = 0, blk = 0] = numbers;
    const [fgM, fgA] = splitPair(fgPairs[0]);
    const [threeM, threeA] = splitPair(fgPairs[1]);
    const [ftM, ftA] = splitPair(fgPairs[2]);

    matched.push({
      raw: line,
      playerId: player.id,
      playerName: player.name,
      stat: {
        playerId: player.id,
        pts,
        reb,
        ast,
        stl,
        blk,
        fgM: fgM ?? 0,
        fgA: fgA ?? 0,
        threeM,
        threeA,
        ftM,
        ftA,
        min,
      },
    });
  }

  return { matched, unmatched };
}

function splitLine(line: string): string[] {
  const multiSplit = line
    .split(/,|\t|\s{2,}/)
    .map((token) => token.trim())
    .filter(Boolean);
  return multiSplit.length > 1 ? multiSplit : line.split(/\s+/).filter(Boolean);
}

function splitPair(pair: string | undefined): [number | undefined, number | undefined] {
  if (!pair) return [undefined, undefined];
  const [a, b] = pair.split("-").map((n) => parseInt(n, 10));
  return [Number.isNaN(a) ? undefined : a, Number.isNaN(b) ? undefined : b];
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findPlayerByName(name: string, roster: Player[]): Player | undefined {
  const target = normalizeName(name);
  return (
    roster.find((player) => normalizeName(player.name) === target) ??
    roster.find((player) => {
      const candidate = normalizeName(player.name);
      return candidate.includes(target) || target.includes(candidate);
    })
  );
}
