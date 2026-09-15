"use client";

import { SegmentedControl } from "@/components/ui/FilterChip";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { useSportsData } from "@/context/SportsDataContext";
import { getEffectiveGameStatus } from "@/lib/derivations";
import { useGameModal } from "@/lib/game-modal-context";
import { cn, formatGameDate } from "@/lib/utils";
import { X } from "lucide-react";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BoxScoreTable } from "./BoxScoreTable";
import { MomentumBar } from "./MomentumBar";
import { PlayByPlayFeed } from "./PlayByPlayFeed";

type DetailTab = "overview" | "boxscore" | "pbp";

const TABS: { value: DetailTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "boxscore", label: "Box Score" },
  { value: "pbp", label: "Play-by-Play" },
];

export function GameDetailModal() {
  const { activeGameId, closeGame } = useGameModal();
  const { games } = useSportsData();
  const [tab, setTab] = useState<DetailTab>("overview");
  const [side, setSide] = useState<"away" | "home">("away");

  const game = games.find((g) => g.id === activeGameId);

  useEffect(() => {
    setTab("overview");
    setSide("away");
  }, [activeGameId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeGame();
    }

    if (!activeGameId) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeGameId, closeGame]);

  if (!game) return null;

  const dateStr = formatGameDate(game.startTime, false);
  const effectiveStatus = getEffectiveGameStatus(game);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={closeGame}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 pb-3 pt-5">
          <div className="flex flex-col">
            <span id="game-detail-title" className="text-xs font-bold uppercase tracking-wider text-muted">
              {game.league} {dateStr ? `\u2022 ${dateStr}` : ""} &middot; {effectiveStatus}
            </span>
            {game.venue && (
              <span className="max-w-[280px] truncate text-[11px] text-muted">
                {game.venue}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={closeGame}
            aria-label="Close game details"
            className="rounded-full p-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center justify-between bg-surface/40 px-6 py-4">
          <Link
            href={`/teams/${game.awayTeam.id}`}
            onClick={closeGame}
            className="flex flex-1 flex-col items-center gap-2 rounded-xl p-1 transition-colors hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <TeamBadge team={game.awayTeam} size="lg" />
            <span className="text-sm font-semibold text-foreground">
              {game.awayTeam.shortName}
            </span>
          </Link>
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {game.awayScore} - {game.homeScore}
            </span>
            <span className="text-[11px] text-muted">
              {effectiveStatus === "LIVE"
                ? game.timeRemaining
                  ? `Q${game.quarterOrSet} \u2022 ${game.timeRemaining}`
                  : `Set ${game.quarterOrSet}`
                : effectiveStatus === "FINAL"
                  ? "Final"
                  : "Upcoming"}
            </span>
          </div>

          <Link
            href={`/teams/${game.homeTeam.id}`}
            onClick={closeGame}
            className="flex flex-1 flex-col items-center gap-2 rounded-xl p-1 transition-colors hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <TeamBadge team={game.homeTeam} size="lg" />
            <span className="text-sm font-semibold text-foreground">
              {game.homeTeam.shortName}
            </span>
          </Link>
        </div>

        <div className="mx-4">
          <SegmentedControl options={TABS} value={tab} onChange={setTab} />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {tab === "overview" ? <MomentumBar game={game} /> : null}

          {tab === "boxscore" ? (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSide("away")}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                    side === "away"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted hover:text-foreground"
                  )}
                >
                  {game.awayTeam.shortName}
                </button>
                <button
                  type="button"
                  onClick={() => setSide("home")}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                    side === "home"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted hover:text-foreground"
                  )}
                >
                  {game.homeTeam.shortName}
                </button>
              </div>
              <BoxScoreTable
                items={game.boxScore[side]}
                league={game.league}
                game={game}
                teamSide={side}
              />
            </div>
          ) : null}

          {tab === "pbp" ? (
            <PlayByPlayFeed
              events={game.playByPlay}
              homeTeam={game.homeTeam}
              awayTeam={game.awayTeam}
              league={game.league}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
