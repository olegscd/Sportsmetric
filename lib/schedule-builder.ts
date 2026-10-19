import { isoToPhtInput } from "@/lib/utils";
import type { Game, Team, TournamentStage } from "@/types/sports";

export interface DraftFixture {
  id: string;
  date: string;
  time: string;
  homeTeamId: string;
  awayTeamId: string;
  venue: string;
  stage: TournamentStage;
}

const STAGES = new Set(["ELIMINATION", "PLAY_IN", "SEMIFINALS", "FINALS"]);
export const MAX_FIXTURES = 100;

export function isDraftFixture(value: unknown): value is DraftFixture {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  return ["id", "date", "time", "homeTeamId", "awayTeamId", "venue", "stage"].every(
    key => typeof draft[key] === "string" && (draft[key] as string).length <= 500
  ) && STAGES.has(draft.stage as string);
}

export function hasFixtureContent(drafts: DraftFixture[]): boolean {
  return drafts.length > 1 || drafts.some(draft => !!draft.homeTeamId || !!draft.awayTeamId);
}

/** Validate the complete batch before any write, including scope and duplicate checks. */
export function validateFixtures(drafts: DraftFixture[], teams: Team[], games: Game[]) {
  const issues: { draftId: string; message: string }[] = [];
  const teamIds = new Set(teams.map(team => team.id));
  const slots = new Map<string, number>();
  const existing = new Set(games.flatMap(game => [game.homeTeam.id, game.awayTeam.id].map(id => `${new Date(game.startTime).getTime()}|${id}`)));
  drafts.forEach((draft, index) => {
    const add = (message: string) => issues.push({ draftId: draft.id, message: `Match ${index + 1}: ${message}` });
    if (!teamIds.has(draft.homeTeamId) || !teamIds.has(draft.awayTeamId)) {
      add("Select two teams from this competition.");
      return;
    }
    if (draft.homeTeamId === draft.awayTeamId) {
      add("Home and away teams must be different.");
      return;
    }
    const input = `${draft.date}T${draft.time}`;
    const date = new Date(`${input}:00+08:00`);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input) || !Number.isFinite(date.getTime()) || isoToPhtInput(date.toISOString()) !== input) {
      add("Enter a valid match date and time.");
      return;
    }
    if (!draft.venue.trim()) add("Enter a venue.");
    if (!STAGES.has(draft.stage)) add("Choose a tournament stage.");
    const keys = [draft.homeTeamId, draft.awayTeamId].map(id => `${date.getTime()}|${id}`);
    const conflict = keys.map(key => slots.get(key)).find(value => value !== undefined);
    if (keys.some(key => existing.has(key))) add("A selected team already has a match at this time. Check the existing schedule.");
    else if (conflict !== undefined) add(`A selected team is also scheduled in match ${conflict + 1} at this time.`);
    for (const key of keys) slots.set(key, index);
  });
  return issues;
}
