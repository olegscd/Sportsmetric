"use client";

import { TeamBadge } from "@/components/ui/TeamBadge";
import { useSportsData } from "@/context/SportsDataContext";
import { useGameModal } from "@/lib/game-modal-context";
import { cn, formatGameDate } from "@/lib/utils";
import { getEffectiveGameStatus } from "@/lib/derivations";
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
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeGame();
      }
    }

    if (activeGameId) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={closeGame}
    >
      <div
        className="relative flex flex-col w-full max-w-lg max-h-[90vh] rounded-3xl border border-border bg-bg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border">
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              {game.league} {dateStr ? `\u2022 ${dateStr}` : ""} &middot; {effectiveStatus}
            </span>
            {game.venue && (
              <span className="text-[11px] text-muted truncate max-w-[280px]">
                {game.venue}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={closeGame}
            className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scoreboard */}
        <div className="flex items-center justify-between px-6 py-4 bg-surface/40">
          <Link
            href={`/teams/${game.awayTeam.id}`}
            onClick={closeGame}
            className="flex flex-1 flex-col items-center gap-2"
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
            className="flex flex-1 flex-col items-center gap-2"
          >
            <TeamBadge team={game.homeTeam} size="lg" />
            <span className="text-sm font-semibold text-foreground">
              {game.homeTeam.shortName}
            </span>
          </Link>
        </div>

        <div className="mx-4 flex shrink-0 items-center gap-1 rounded-full bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn(
                "flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors",
                tab === t.value ? "bg-primary text-primary-foreground" : "text-muted"
              )}
            >
              {t.label}
            </button>
          ))}
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
                    "rounded-full border px-3 py-1 text-xs font-semibold",
                    side === "away" ? "border-primary text-primary" : "border-border text-muted"
                  )}
                >
                  {game.awayTeam.shortName}
                </button>
                <button
                  type="button"
                  onClick={() => setSide("home")}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold",
                    side === "home" ? "border-primary text-primary" : "border-border text-muted"
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
