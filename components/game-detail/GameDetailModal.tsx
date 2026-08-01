"use client";

import { TeamBadge } from "@/components/ui/TeamBadge";
import { useSportsData } from "@/context/SportsDataContext";
import { useGameModal } from "@/lib/game-modal-context";
import { cn } from "@/lib/utils";
import type { Game } from "@/types/sports";
import { X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
  const game = activeGameId ? games.find((g) => g.id === activeGameId) : undefined;

  if (!game) return null;

  return <GameDetailSheet key={game.id} game={game} onClose={closeGame} />;
}

function GameDetailSheet({ game, onClose }: { game: Game; onClose: () => void }) {
  const [tab, setTab] = useState<DetailTab>("overview");
  const [side, setSide] = useState<"away" | "home">("away");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close game details"
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />

      <div className="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border-t border-border bg-elevated">
        <div className="flex shrink-0 items-center justify-center pt-2.5">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        <div className="flex shrink-0 items-start justify-between px-4 pt-2">
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              {game.league} &middot; {game.status}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-muted active:bg-surface"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
          <Link
            href={`/teams/${game.awayTeam.id}`}
            onClick={onClose}
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
              {game.status === "LIVE"
                ? game.timeRemaining
                  ? `Q${game.quarterOrSet} \u2022 ${game.timeRemaining}`
                  : `Set ${game.quarterOrSet}`
                : game.status === "FINAL"
                  ? "Final"
                  : "Upcoming"}
            </span>
          </div>
          <Link
            href={`/teams/${game.homeTeam.id}`}
            onClick={onClose}
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
              <BoxScoreTable items={game.boxScore[side]} />
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
