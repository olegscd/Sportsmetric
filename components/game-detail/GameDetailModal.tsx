"use client";

import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/FilterChip";
import { Notice } from "@/components/ui/Notice";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { useSportsData } from "@/context/SportsDataContext";
import { getEffectiveGameStatus } from "@/lib/derivations";
import { useGameModal } from "@/lib/game-modal-context";
import { cn, formatGameDate } from "@/lib/utils";
import { X } from "lucide-react";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BoxScoreTable } from "./BoxScoreTable";
import { MomentumBar } from "./MomentumBar";
import { PlayByPlayFeed } from "./PlayByPlayFeed";
import { GameActions } from "./GameActions";
import type { PlayByPlayEvent } from "@/types/sports";

type DetailTab = "overview" | "boxscore" | "pbp";

const TABS: { value: DetailTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "boxscore", label: "Box Score" },
  { value: "pbp", label: "Play-by-Play" },
];

export function GameDetailModal() {
  const { activeGameId, closeGame } = useGameModal();
  const { games, seasons } = useSportsData();
  const [tab, setTab] = useState<DetailTab>("overview");
  const [side, setSide] = useState<"away" | "home">("away");
  const [loadedGameId, setLoadedGameId] = useState<string | null>(activeGameId);
  const [details, setDetails] = useState<{ id: string; events?: PlayByPlayEvent[]; error?: string } | null>(null);
  const [retryDetails, setRetryDetails] = useState(0);

  useEffect(() => {
    if (!activeGameId || tab !== "pbp") return;
    const controller = new AbortController();
    fetch(`/api/games/${encodeURIComponent(activeGameId)}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Could not load play-by-play.");
        const data = await response.json();
        if (!controller.signal.aborted) setDetails({ id: activeGameId, events: data.play_by_play ?? [] });
      }).catch(error => {
        if (!controller.signal.aborted) setDetails({ id: activeGameId, error: error.message });
      });
    return () => controller.abort();
  }, [activeGameId, tab, retryDetails]);

  // Reset the tab/mobile-side selection when a different game is opened.
  // Adjusting state during render (rather than in an effect) avoids a frame
  // where the previous game's tab is shown for the new game.
  if (loadedGameId !== activeGameId) {
    setLoadedGameId(activeGameId);
    setTab("overview");
    setSide("away");
  }

  const game = games.find((g) => g.id === activeGameId);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeGameId) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = requestAnimationFrame(() => dialogRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeGame();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      // Keep keyboard focus inside the modal while it is open.
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.getClientRects().length > 0);

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={closeGame}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-panel border border-border bg-bg shadow-modal focus:outline-none sm:max-h-[90vh] sm:rounded-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" />

        <div className="flex items-start justify-between gap-3 border-b border-border px-4 pb-3 pt-3 sm:px-6 sm:pt-5">
          <div className="min-w-0">
            <span id="game-detail-title" className="block truncate text-2xs font-bold uppercase tracking-wider text-muted">
              {game.league} {dateStr ? `• ${dateStr}` : ""} &middot; {effectiveStatus}
            </span>
            {game.venue && (
              <span className="block max-w-[280px] truncate text-2xs text-muted">
                {game.venue}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-lg"
            onClick={closeGame}
            aria-label="Close game details"
            className="-mr-2 -mt-1 shrink-0"
          >
            <X size={18} aria-hidden="true" />
          </Button>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 bg-surface/40 px-3 py-4 sm:gap-4 sm:px-6">
          <Link
            href={`/teams/${game.awayTeam.id}`}
            onClick={closeGame}
            className="flex min-w-0 flex-col items-center gap-2 rounded-control p-1 transition-colors hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <TeamBadge team={game.awayTeam} size="lg" />
            <span className="max-w-full truncate text-sm font-semibold text-foreground">
              {game.awayTeam.shortName}
            </span>
          </Link>
          <div className="flex flex-col items-center gap-1">
            <span className="whitespace-nowrap text-xl font-bold tabular-nums text-foreground sm:text-2xl">
              {game.awayScore} - {game.homeScore}
            </span>
            <span className="text-2xs text-muted">
              {effectiveStatus === "LIVE"
                ? game.timeRemaining
                  ? `Q${game.quarterOrSet} • ${game.timeRemaining}`
                  : `Set ${game.quarterOrSet}`
                : effectiveStatus === "FINAL"
                  ? "Final"
                  : "Upcoming"}
            </span>
          </div>

          <Link
            href={`/teams/${game.homeTeam.id}`}
            onClick={closeGame}
            className="flex min-w-0 flex-col items-center gap-2 rounded-control p-1 transition-colors hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <TeamBadge team={game.homeTeam} size="lg" />
            <span className="max-w-full truncate text-sm font-semibold text-foreground">
              {game.homeTeam.shortName}
            </span>
          </Link>
        </div>

        <div className="px-4 pt-3 sm:px-6 empty:hidden">
          <GameActions game={game} status={effectiveStatus} season={seasons.find(s => s.id === game.seasonId)} />
        </div>

        <div className="px-4 pt-3 sm:px-6">
          <SegmentedControl options={TABS} value={tab} onChange={setTab} />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-4">
          {tab === "overview" ? <MomentumBar game={game} /> : null}

          {tab === "boxscore" ? (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSide("away")}
                  className={cn(
                    "min-h-10 rounded-control border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
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
                    "min-h-10 rounded-control border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
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
            details?.id !== game.id ? (
              <SkeletonRows count={5} />
            ) : details.error ? (
              <Notice
                tone="error"
                title="Couldn't load play-by-play"
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRetryDetails((value) => value + 1)}
                  >
                    Retry
                  </Button>
                }
              >
                {details.error}
              </Notice>
            ) : (
              <PlayByPlayFeed
                events={details.events ?? []}
                homeTeam={game.homeTeam}
                awayTeam={game.awayTeam}
                league={game.league}
              />
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
