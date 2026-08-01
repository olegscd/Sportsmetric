"use client";

import type { ToastFn } from "@/components/admin/Toast";
import { useSportsData } from "@/context/SportsDataContext";
import { parseBoxScoreText, type ParseBoxScoreResult } from "@/lib/box-score-parser";
import { useState } from "react";
import { Field, labelClass, primaryButtonClass, SectionCard, selectClass } from "./formPrimitives";

const PLACEHOLDER = `Kevin Quiambao, 32:00, 26, 12, 5, 3, 1, 10-17, 2-5, 4-5
JD Cagulangan, 30:15, 14, 3, 8, 2, 0, 5-11, 2-6, 2-2`;

export function BoxScoreParserTab({ onToast }: { onToast: ToastFn }) {
  const { games: allGames, seasons, players, updateGameBoxScore, currentSeasonId } = useSportsData();

  const [seasonFilter, setSeasonFilter] = useState(() => currentSeasonId);
  const games = allGames.filter((g) => g.seasonId === seasonFilter);

  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const [side, setSide] = useState<"home" | "away">("away");
  const [text, setText] = useState("");
  const [result, setResult] = useState<ParseBoxScoreResult | null>(null);

  const game = games.find((g) => g.id === gameId);
  const targetTeamId = game ? (side === "home" ? game.homeTeam.id : game.awayTeam.id) : "";
  const roster = players.filter((p) => p.teamId === targetTeamId);

  function handleParseAndApply() {
    if (!game) {
      onToast("Pick a game first.", "error");
      return;
    }
    if (!text.trim()) {
      onToast("Paste some box score text first.", "error");
      return;
    }

    const parsed = parseBoxScoreText(text, roster);
    setResult(parsed);

    if (parsed.matched.length === 0) {
      onToast("No player rows could be matched -- nothing was applied.", "error");
      return;
    }

    void updateGameBoxScore(
      game.id,
      side,
      parsed.matched.map((row) => row.stat)
    );

    const sideLabel = side === "home" ? game.homeTeam.shortName : game.awayTeam.shortName;
    onToast(
      `Applied ${parsed.matched.length} player line${parsed.matched.length === 1 ? "" : "s"} to ${sideLabel}'s box score!`
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionCard>
        <p className="text-sm font-bold text-foreground">Raw Box Score Text Parser</p>
        <p className="text-xs text-muted">
          Paste stats copied from a live-stats site below. One player per line, columns separated
          by commas, tabs, or multiple spaces. Recognized shape:
        </p>
        <p className="rounded-lg border border-border bg-elevated p-2 font-mono text-[11px] text-muted">
          Name, MIN, PTS, REB, AST, STL, BLK, FGM-FGA, 3PM-3PA, FTM-FTA
        </p>
        <p className="text-[11px] text-muted">
          MIN and the made-attempted pairs are optional and recognized by shape; any other plain
          numbers found are read in order as PTS, REB, AST, STL, BLK.
        </p>
      </SectionCard>

      <SectionCard>
        <Field label="Season">
          <select
            className={selectClass}
            value={seasonFilter}
            onChange={(event) => {
              const nextSeasonId = event.target.value;
              setSeasonFilter(nextSeasonId);
              const gamesInNextSeason = allGames.filter((g) => g.seasonId === nextSeasonId);
              setGameId(gamesInNextSeason[0]?.id ?? "");
              setResult(null);
            }}
          >
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Game">
            <select
              className={selectClass}
              value={gameId}
              onChange={(event) => {
                setGameId(event.target.value);
                setResult(null);
              }}
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.awayTeam.shortName} @ {g.homeTeam.shortName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Team Side">
            <select
              className={selectClass}
              value={side}
              onChange={(event) => {
                setSide(event.target.value as "home" | "away");
                setResult(null);
              }}
            >
              {game ? (
                <>
                  <option value="away">{game.awayTeam.shortName} (Away)</option>
                  <option value="home">{game.homeTeam.shortName} (Home)</option>
                </>
              ) : null}
            </select>
          </Field>
        </div>

        <Field label="Roster this will match against">
          <p className="text-xs text-muted">
            {roster.length > 0 ? roster.map((p) => p.name).join(", ") : "No players on this team yet."}
          </p>
        </Field>

        <Field label="Raw Box Score Text">
          <textarea
            className={`${selectClass} min-h-40 resize-y font-mono text-xs`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={PLACEHOLDER}
          />
        </Field>

        <button type="button" onClick={handleParseAndApply} className={primaryButtonClass}>
          Parse &amp; Apply
        </button>
      </SectionCard>

      {result ? (
        <SectionCard>
          <p className={labelClass}>Matched ({result.matched.length})</p>
          {result.matched.length === 0 ? (
            <p className="text-xs text-muted">No lines matched a roster player.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {result.matched.map((row) => (
                <div
                  key={row.playerId}
                  className="flex items-center justify-between rounded-lg border border-success/20 bg-success/10 px-2.5 py-1.5 text-xs text-foreground"
                >
                  <span className="truncate font-semibold">{row.playerName}</span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {row.stat.pts} PTS &middot; {row.stat.reb} REB &middot; {row.stat.ast} AST
                  </span>
                </div>
              ))}
            </div>
          )}

          {result.unmatched.length > 0 ? (
            <>
              <p className={labelClass}>Skipped ({result.unmatched.length})</p>
              <div className="flex flex-col gap-1.5">
                {result.unmatched.map((row, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-live/20 bg-live/10 px-2.5 py-1.5 text-xs text-muted"
                  >
                    <span className="block truncate font-mono text-[11px] text-muted">{row.raw}</span>
                    {row.reason}
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </SectionCard>
      ) : null}
    </div>
  );
}
