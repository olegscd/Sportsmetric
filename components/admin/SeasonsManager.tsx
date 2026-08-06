"use client";

import type { ToastFn } from "@/components/admin/Toast";
import { useSportsData } from "@/context/SportsDataContext";
import { generateId } from "@/lib/data";
import { inferLeague } from "@/lib/league-utils";
import { cn } from "@/lib/utils";
import type { League, Season } from "@/types/sports";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  dangerButtonClass,
  Field,
  ghostButtonClass,
  inputClass,
  primaryButtonClass,
  SectionCard,
  selectClass,
} from "./formPrimitives";

const LEAGUES: (League | "ALL")[] = ["UAAP", "PBA", "PVL", "ALL"];

function getSeasonLeague(s: Season): League {
  return inferLeague(s.id, s.league);
}

export function SeasonsManager({ onToast }: { onToast: ToastFn }) {
  const {
    seasons,
    teams,
    players,
    games,
    saveSeason,
    deleteSeason,
    setSeasonAsCurrent,
    reorderSeasons,
  } = useSportsData();

  const [selectedLeague, setSelectedLeague] = useState<League | "ALL">("UAAP");
  const [label, setLabel] = useState("");
  const [createLeague, setCreateLeague] = useState<League>("UAAP");

  const filteredSeasons = seasons.filter(
    (s) => selectedLeague === "ALL" || getSeasonLeague(s) === selectedLeague
  );

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      onToast("Season label is required.", "error");
      return;
    }

    let id = generateId();
    const yearMatch = trimmedLabel.match(/\b(20\d{2}(?:-\d{2,4})?)\b/);
    if (createLeague === "UAAP" && yearMatch) {
      id = yearMatch[1];
    } else if (createLeague === "PBA") {
      const slug = trimmedLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      id = slug.startsWith("pba-") ? slug : `pba-${slug}`;
    } else if (createLeague === "PVL") {
      const slug = trimmedLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      id = slug.startsWith("pvl-") ? slug : `pvl-${slug}`;
    }

    const season: Season = {
      id,
      label: trimmedLabel,
      isCurrent: false,
      league: createLeague,
    };

    void saveSeason(season);
    setLabel("");
    onToast(`Season created successfully for ${createLeague}!`);
  }

  function handleSetCurrent(season: Season) {
    void setSeasonAsCurrent(season.id);
    onToast(`${season.label} is now the current season.`);
  }

  function handleMoveUp(index: number) {
    if (index <= 0) return;
    const next = [...seasons];
    const itemToMove = filteredSeasons[index];
    const prevItem = filteredSeasons[index - 1];

    const idxA = next.findIndex((s) => s.id === itemToMove.id);
    const idxB = next.findIndex((s) => s.id === prevItem.id);

    if (idxA >= 0 && idxB >= 0) {
      const temp = next[idxA];
      next[idxA] = next[idxB];
      next[idxB] = temp;
      void reorderSeasons(next);
      onToast("Season order updated.");
    }
  }

  function handleMoveDown(index: number) {
    if (index >= filteredSeasons.length - 1) return;
    const next = [...seasons];
    const itemToMove = filteredSeasons[index];
    const nextItem = filteredSeasons[index + 1];

    const idxA = next.findIndex((s) => s.id === itemToMove.id);
    const idxB = next.findIndex((s) => s.id === nextItem.id);

    if (idxA >= 0 && idxB >= 0) {
      const temp = next[idxA];
      next[idxA] = next[idxB];
      next[idxB] = temp;
      void reorderSeasons(next);
      onToast("Season order updated.");
    }
  }

  function handleDelete(season: Season) {
    const teamCount = teams.filter((t) => t.seasonId === season.id).length;
    const playerCount = players.filter((p) => p.seasonId === season.id).length;
    const gameCount = games.filter((g) => g.seasonId === season.id).length;
    const hasData = teamCount + playerCount + gameCount > 0;
    const warning = hasData
      ? ` This season has ${teamCount} team(s), ${playerCount} player(s) and ${gameCount} game(s) attached.`
      : "";

    if (!window.confirm(`Delete "${season.label}" (${getSeasonLeague(season)})?${warning} This can't be undone.`)) return;
    void deleteSeason(season.id);
    onToast("Season deleted.");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-1 rounded-full bg-surface p-1">
        {LEAGUES.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => {
              setSelectedLeague(l);
              if (l !== "ALL") setCreateLeague(l);
            }}
            className={cn(
              "flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors",
              selectedLeague === l ? "bg-primary text-primary-foreground" : "text-muted"
            )}
          >
            {l === "ALL" ? "All Leagues" : l}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {filteredSeasons.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">
            No seasons created yet for {selectedLeague}. Add one below!
          </p>
        ) : (
          filteredSeasons.map((season, index) => {
            const teamCount = teams.filter((t) => t.seasonId === season.id).length;
            const playerCount = players.filter((p) => p.seasonId === season.id).length;
            const gameCount = games.filter((g) => g.seasonId === season.id).length;
            const leagueLabel = getSeasonLeague(season);

            return (
              <div
                key={season.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMoveUp(index)}
                      title="Move season up"
                      className="rounded p-0.5 text-muted hover:bg-elevated hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      disabled={index === filteredSeasons.length - 1}
                      onClick={() => handleMoveDown(index)}
                      title="Move season down"
                      className="rounded p-0.5 text-muted hover:bg-elevated hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-foreground">{season.label}</p>
                      <span className="shrink-0 rounded bg-muted/20 px-1.5 py-0.5 text-[9px] font-bold text-muted uppercase">
                        {leagueLabel}
                      </span>
                      {season.isCurrent ? (
                        <span className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                          CURRENT
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-[11px] text-muted">
                      {teamCount} teams &middot; {playerCount} players &middot; {gameCount} games
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 gap-1.5">
                  {!season.isCurrent ? (
                    <button
                      type="button"
                      onClick={() => handleSetCurrent(season)}
                      className={ghostButtonClass}
                    >
                      Set Current
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleDelete(season)}
                    className={dangerButtonClass}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleCreate}>
        <SectionCard>
          <p className="text-sm font-bold text-foreground">Add Season</p>

          <Field label="Target League">
            <select
              className={selectClass}
              value={createLeague}
              onChange={(e) => setCreateLeague(e.target.value as League)}
            >
              <option value="UAAP">UAAP</option>
              <option value="PBA">PBA</option>
              <option value="PVL">PVL</option>
            </select>
          </Field>

          <Field label="Season Label">
            <input
              className={inputClass}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. 2026-27 Season"
            />
          </Field>
          <button type="submit" className={primaryButtonClass}>
            Create Season for {createLeague}
          </button>
          <p className="text-[11px] text-muted">
            New seasons start empty -- add teams, players and games to them from the other tabs.
            Seasons are automatically filtered by league when users browse Standings and Match Center.
          </p>
        </SectionCard>
      </form>
    </div>
  );
}
