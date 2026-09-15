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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateSeasonId(trimmedLabel: string, league: League): string {
  const baseSlug = slugify(trimmedLabel);

  if (league === "UAAP") {
    const yearMatch = trimmedLabel.match(/\b(20\d{2}(?:-\d{2,4})?)\b/);
    const specificQualifier = trimmedLabel
      .replace(/\b(20\d{2}(?:-\d{2,4})?)\b/gi, "")
      .replace(/\b(uaap|season|s\d+)\b/gi, "")
      .replace(/[^a-z0-9]/gi, "");

    // If the label is purely a generic year/season (e.g. "2026-27", "2026-27 Season", "UAAP S89")
    if (yearMatch && specificQualifier.length === 0) {
      return yearMatch[1];
    }
    // If it has tournament, sport, or division qualifiers (e.g. "Men's Basketball", "U16 Basketball")
    return baseSlug || generateId();
  }

  if (league === "PBA") {
    return baseSlug.startsWith("pba-") ? baseSlug : `pba-${baseSlug}`;
  }

  if (league === "PVL") {
    return baseSlug.startsWith("pvl-") ? baseSlug : `pvl-${baseSlug}`;
  }

  return baseSlug || generateId();
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
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  const filteredSeasons = seasons.filter(
    (s) => selectedLeague === "ALL" || getSeasonLeague(s) === selectedLeague
  );

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      onToast("Season label is required.", "error");
      return;
    }

    const id = generateSeasonId(trimmedLabel, createLeague);

    if (seasons.some((s) => s.id === id)) {
      onToast(
        `A season with ID "${id}" already exists. If this is for a specific tournament or division (e.g. U16 Basketball), please ensure the label is distinct.`,
        "error"
      );
      return;
    }

    const season: Season = {
      id,
      label: trimmedLabel,
      isCurrent: false,
      league: createLeague,
    };

    try {
      await saveSeason(season);
      setLabel("");
      onToast(`Season created successfully for ${createLeague}!`);
    } catch {
      onToast("Failed to create season in database.", "error");
    }
  }

  function handleStartEdit(season: Season) {
    setEditingSeasonId(season.id);
    setEditingLabel(season.label);
  }

  async function handleSaveEdit(season: Season) {
    const trimmed = editingLabel.trim();
    if (!trimmed) {
      onToast("Season label cannot be empty.", "error");
      return;
    }
    try {
      await saveSeason({ ...season, label: trimmed });
      setEditingSeasonId(null);
      onToast(`Season updated to "${trimmed}".`);
    } catch {
      onToast("Failed to update season label in database.", "error");
    }
  }

  async function handleSetCurrent(season: Season) {
    try {
      await setSeasonAsCurrent(season.id);
      onToast(`${season.label} is now the current season.`);
    } catch {
      onToast("Failed to update current season in database.", "error");
    }
  }

  async function handleMoveUp(index: number) {
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
      try {
        await reorderSeasons(next);
        onToast("Season order updated.");
      } catch {
        onToast("Failed to save season order to database.", "error");
      }
    }
  }

  async function handleMoveDown(index: number) {
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
      try {
        await reorderSeasons(next);
        onToast("Season order updated.");
      } catch {
        onToast("Failed to save season order to database.", "error");
      }
    }
  }

  async function handleDelete(season: Season) {
    const teamCount = teams.filter((t) => t.seasonId === season.id).length;
    const playerCount = players.filter((p) => p.seasonId === season.id).length;
    const gameCount = games.filter((g) => g.seasonId === season.id).length;
    const hasData = teamCount + playerCount + gameCount > 0;
    const warning = hasData
      ? ` This season has ${teamCount} team(s), ${playerCount} player(s) and ${gameCount} game(s) attached.`
      : "";

    if (!window.confirm(`Delete "${season.label}" (${getSeasonLeague(season)})?${warning} This can't be undone.`)) return;
    try {
      await deleteSeason(season.id);
      onToast("Season deleted.");
    } catch {
      onToast("Failed to delete season from database.", "error");
    }
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
                <div className="flex items-center gap-2 min-w-0 flex-1">
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

                  {editingSeasonId === season.id ? (
                    <div className="flex flex-1 items-center gap-2 min-w-0">
                      <input
                        type="text"
                        value={editingLabel}
                        onChange={(e) => setEditingLabel(e.target.value)}
                        className="flex-1 rounded-lg border border-border bg-elevated px-2.5 py-1 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSaveEdit(season);
                          } else if (e.key === "Escape") {
                            setEditingSeasonId(null);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(season)}
                        className="rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground active:opacity-80 shrink-0 cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSeasonId(null)}
                        className={cn(ghostButtonClass, "shrink-0 cursor-pointer")}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
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
                  )}
                </div>

                {editingSeasonId !== season.id && (
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(season)}
                      className={ghostButtonClass}
                    >
                      Edit
                    </button>
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
                )}
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
