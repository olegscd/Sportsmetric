"use client";

import type { ToastFn } from "@/components/admin/Toast";
import { useSportsData } from "@/context/SportsDataContext";
import type { ExtractedBoxRow, ExtractedGamePayload } from "@/lib/game-extractor";
import { inferLeague } from "@/lib/league-utils";
import { cn, formatGameDate } from "@/lib/utils";
import type { Game, League, TournamentStage } from "@/types/sports";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  ListPlus,
  Loader2,
  MapPin,
  Sparkles,
  Trash2,
} from "lucide-react";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { TableShell } from "@/components/ui/Table";
import { Field, primaryButtonClass, SectionCard, selectClass } from "./formPrimitives";

const LEAGUES: League[] = ["UAAP", "PBA", "PVL"];

const STAGES: { value: TournamentStage; label: string }[] = [
  { value: "ELIMINATION", label: "Elimination / Regular Season (Standings)" },
  { value: "SEMIFINALS", label: "Semifinals / Final Four (Playoffs)" },
  { value: "FINALS", label: "Finals Series (Playoffs)" },
  { value: "PLAY_IN", label: "Play-In Tournament" },
];

const STATUSES: { value: "FINAL" | "LIVE" | "UPCOMING"; label: string }[] = [
  { value: "FINAL", label: "FINAL (Match Concluded - Updates Stats)" },
  { value: "LIVE", label: "LIVE (In-Progress Match)" },
  { value: "UPCOMING", label: "UPCOMING (Scheduled Match)" },
];

interface BatchItem {
  id: string;
  rawUrl: string;
  status: "idle" | "extracting" | "ready" | "ingesting" | "saved" | "error";
  error?: string;
  game?: Game;
  parsedPayload?: ExtractedGamePayload;
  expanded?: boolean;
}

export function GameImporterTab({ onToast }: { onToast: ToastFn }) {
  const { seasons, refreshData } = useSportsData();
  const [league, setLeague] = useState<League>("PBA");
  const [stage, setStage] = useState<TournamentStage>("ELIMINATION");
  const [status, setStatus] = useState<"FINAL" | "LIVE" | "UPCOMING">("FINAL");
  const [urlInput, setUrlInput] = useState("");

  const leagueSeasons = useMemo(
    () => seasons.filter((s) => inferLeague(s) === league),
    [seasons, league]
  );

  const [seasonId, setSeasonId] = useState<string>("");

  // Derive the effective season during render instead of syncing it in an
  // effect. When the league changes, the previously selected season is no
  // longer in leagueSeasons, so fall back to that league's current season.
  const effectiveSeasonId = leagueSeasons.some((s) => s.id === seasonId)
    ? seasonId
    : leagueSeasons.find((s) => s.isCurrent)?.id ?? leagueSeasons[0]?.id ?? "";

  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [isExtractingAll, setIsExtractingAll] = useState(false);
  const [isIngestingAll, setIsIngestingAll] = useState(false);
  const contextLocked = isExtractingAll || isIngestingAll || batchItems.length > 0;

  // Parse lines from textarea into candidate URLs/IDs
  const parsedUrls = useMemo(() => {
    return [...new Set(urlInput
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0))];
  }, [urlInput]);

  function handleLeagueChange(newLeague: League) {
    setLeague(newLeague);
    const targetSeasons = seasons.filter((s) => inferLeague(s) === newLeague);
    const curr = targetSeasons.find((s) => s.isCurrent)?.id ?? targetSeasons[0]?.id ?? "";
    setSeasonId(curr);
    setBatchItems([]);
  }

  async function handleBatchExtract() {
    if (contextLocked) return;
    if (parsedUrls.length > 50) { onToast("Preview up to 50 matches at a time.", "error"); return; }
    if (parsedUrls.length === 0) {
      onToast("Please enter at least one game URL or match ID.", "error");
      return;
    }
    if (!effectiveSeasonId) {
      onToast("Please select a target season.", "error");
      return;
    }

    setIsExtractingAll(true);
    const initialItems: BatchItem[] = parsedUrls.map((u, i) => ({
      id: `${i}-${Date.now()}`,
      rawUrl: u,
      status: "extracting",
    }));
    setBatchItems(initialItems);

    let successCount = 0;
    let failCount = 0;

    const updatedItems = [...initialItems];

    for (let i = 0; i < initialItems.length; i++) {
      const item = initialItems[i];
      try {
        const res = await fetch("/api/admin/ingest-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: item.rawUrl,
            league,
            seasonId: effectiveSeasonId,
            stage,
            status,
            previewOnly: true,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || data.details || "Extraction failed.");
        }

        updatedItems[i] = {
          ...item,
          status: "ready",
          game: data.game,
          parsedPayload: data.parsedPayload,
        };
        successCount++;
      } catch (err: unknown) {
        const e = err as { message: string };
        updatedItems[i] = {
          ...item,
          status: "error",
          error: e.message || "Failed to extract match.",
        };
        failCount++;
      }
      setBatchItems([...updatedItems]);
    }

    setIsExtractingAll(false);

    if (successCount > 0) {
      onToast(`Extracted ${successCount} match${successCount > 1 ? "es" : ""} successfully!`);
    }
    if (failCount > 0) {
      onToast(`${failCount} match${failCount > 1 ? "es" : ""} could not be extracted.`, "error");
    }
  }

  async function handleIngestAllReady() {
    if (isExtractingAll || isIngestingAll) return;
    const readyItems = batchItems.filter((item) => item.status === "ready");
    if (readyItems.length === 0) {
      onToast("No matches are ready for ingestion.", "error");
      return;
    }

    setIsIngestingAll(true);
    let savedCount = 0;
    let failCount = 0;

    const currentItems = [...batchItems];

    for (let i = 0; i < currentItems.length; i++) {
      const item = currentItems[i];
      if (item.status !== "ready") continue;

      currentItems[i] = { ...item, status: "ingesting" };
      setBatchItems([...currentItems]);

      try {
        const res = await fetch("/api/admin/ingest-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: item.rawUrl,
            league,
            seasonId: effectiveSeasonId,
            stage,
            status,
            previewOnly: false,
            // Save exactly what was previewed; otherwise the server would
            // fetch and parse the source a second time.
            parsedPayload: item.parsedPayload,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || data.details || "Save failed.");
        }

        currentItems[i] = { ...item, status: "saved" };
        savedCount++;
      } catch (err: unknown) {
        const e = err as { message: string };
        currentItems[i] = {
          ...item,
          status: "error",
          error: e.message || "Failed to save into database.",
        };
        failCount++;
      }
      setBatchItems([...currentItems]);
    }

    setIsIngestingAll(false);
    await refreshData();

    if (savedCount > 0) {
      onToast(`Successfully ingested ${savedCount} match${savedCount > 1 ? "es" : ""} into database!`);
    }
    if (failCount > 0) {
      onToast(`${failCount} match${failCount > 1 ? "es" : ""} failed to save.`, "error");
    }
  }

  function toggleExpand(id: string) {
    setBatchItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, expanded: !item.expanded } : item))
    );
  }

  function removeItem(id: string) {
    if (isExtractingAll || isIngestingAll) return;
    setBatchItems((prev) => prev.filter((item) => item.id !== id));
  }

  const readyCount = batchItems.filter((i) => i.status === "ready").length;
  const savedCount = batchItems.filter((i) => i.status === "saved").length;

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        title="Import official match reports"
        action={
          <Badge tone="primary" icon={<Sparkles size={12} aria-hidden="true" />}>
            Batch Importer
          </Badge>
        }
      >
        <p className="text-xs text-muted">
          Paste one or more LiveStats links, <code className="font-mono text-2xs text-primary">pba.ph/recap?match=...</code> URLs,
          or raw match IDs (one per line, up to 50). Preview the extracted results, then confirm the matches you want to publish. Duplicate lines are automatically removed.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          {/* League Selector */}
          <div className="flex items-center gap-1 rounded-control border border-border bg-surface-2 p-1">
            {LEAGUES.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => handleLeagueChange(l)}
                disabled={contextLocked}
                aria-pressed={league === l}
                className={cn(
                  "min-h-10 flex-1 rounded-control text-xs font-semibold transition-colors disabled:opacity-60",
                  league === l ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"
                )}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Target Season">
              <select
                className={selectClass}
                value={effectiveSeasonId}
                onChange={(e) => setSeasonId(e.target.value)}
                disabled={contextLocked}
              >
                {leagueSeasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} {s.isCurrent ? "★ Current" : ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Tournament Stage">
              <select
                className={selectClass}
                value={stage}
                onChange={(e) => setStage(e.target.value as TournamentStage)}
                disabled={contextLocked}
              >
                {STAGES.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Match Status">
              <select
                className={selectClass}
                value={status}
                onChange={(e) => setStatus(e.target.value as "FINAL" | "LIVE" | "UPCOMING")}
                disabled={contextLocked}
              >
                {STATUSES.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Multi-Link Textarea */}
          <Field
            label={`Game URLs or Match IDs (${parsedUrls.length > 0 ? `${parsedUrls.length} link${parsedUrls.length > 1 ? "s" : ""} detected` : "Paste multiple links, 1 per line"})`}
          >
            <div className="relative">

              <textarea
                className="min-h-28 w-full rounded-control border border-border bg-surface-2 px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder={
                  league === "PBA"
                    ? "https://pba.ph/recap?match=553\nhttps://pba.ph/recap?match=554\n555"
                    : "https://uaap.livestats.ph/tournaments/uaap-season-87-men-s-basketball?game_id=56\n57\n58"
                }
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                disabled={contextLocked}
              />
            </div>
          </Field>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleBatchExtract}
              disabled={contextLocked || parsedUrls.length === 0 || parsedUrls.length > 50 || !effectiveSeasonId}
              className={cn(
                primaryButtonClass,
                "gap-2 px-5",
                (isExtractingAll || parsedUrls.length === 0) && "cursor-not-allowed opacity-60"
              )}
            >
              {isExtractingAll ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  Extracting Matches...
                </>
              ) : (
                <>
                  <ListPlus size={14} aria-hidden="true" />
                  Fetch &amp; Preview {parsedUrls.length > 0 ? `(${parsedUrls.length}) Matches` : "Matches"}
                </>
              )}
            </button>

            {readyCount > 0 && (
              <button
                type="button"
                onClick={handleIngestAllReady}
                disabled={isIngestingAll || isExtractingAll}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-control bg-positive px-5 text-xs font-bold text-bg shadow-raised transition-colors hover:bg-positive/90",
                  isIngestingAll && "cursor-not-allowed opacity-60"
                )}
              >
                {isIngestingAll ? (
                  <>
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    Saving {readyCount} Game{readyCount > 1 ? "s" : ""} to Database...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} aria-hidden="true" />
                    Publish {readyCount} ready match{readyCount === 1 ? "" : "es"}
                  </>
                )}
              </button>
            )}

            {savedCount > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-positive">
                <CheckCircle2 size={14} aria-hidden="true" />
                {savedCount} match{savedCount > 1 ? "es" : ""} published
              </span>
            )}
          </div>
        </div>
        {batchItems.length > 0 && (
          <Notice
            tone="info"
            className="mt-1"
            action={
              <button
                type="button"
                disabled={isExtractingAll || isIngestingAll}
                onClick={() => {
                  setBatchItems([]);
                  setUrlInput("");
                }}
                className="inline-flex min-h-10 shrink-0 items-center rounded-control border border-border bg-surface-2 px-3 font-semibold text-foreground transition-colors hover:bg-elevated disabled:opacity-50"
              >
                Clear queue
              </button>
            }
          >
            <p className="text-xs">
              Competition settings are locked to the preview. Clear the queue to start another import.
            </p>
          </Notice>
        )}
      </SectionCard>

      {/* Extracted Matches Preview List */}
      {batchItems.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <h3 className="flex items-center gap-2 text-2xs font-bold uppercase tracking-wider text-muted">
              <Layers size={14} aria-hidden="true" />
              Extracted Match Queue ({batchItems.length})
            </h3>
            <span className="text-2xs text-muted">
              {readyCount} ready • {savedCount} saved
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {batchItems.map((item, index) => {
              const game = item.game;
              const payload = item.parsedPayload;

              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-card border p-4 transition-colors",
                    item.status === "saved"
                      ? "border-positive/40 bg-positive/5"
                      : item.status === "error"
                        ? "border-negative/40 bg-negative/5"
                        : item.status === "ready"
                          ? "border-border bg-surface hover:border-primary/40"
                          : "border-border bg-surface opacity-70"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Match Headline */}
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-2xs font-bold text-muted">
                        #{index + 1}
                      </span>

                      {item.status === "extracting" && (
                        <div className="flex items-center gap-2 text-xs text-muted">
                          <Loader2 size={14} className="animate-spin text-primary" aria-hidden="true" />
                          <span className="min-w-0 break-all">Extracting from: <code className="font-mono text-foreground">{item.rawUrl}</code></span>
                        </div>
                      )}

                      {item.status === "error" && (
                        <div className="flex min-w-0 items-center gap-2 text-xs text-negative">
                          <AlertCircle size={14} aria-hidden="true" />
                          <span className="min-w-0 break-words">
                            <strong className="font-mono">{item.rawUrl}</strong>: {item.error}
                          </span>
                        </div>
                      )}

                      {(item.status === "ready" || item.status === "ingesting" || item.status === "saved") && game && (
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-black text-foreground">
                              {game.homeTeam.shortName}{" "}
                              <span className="text-xs font-normal text-muted">({game.homeScore})</span>
                            </span>
                            <span className="text-xs font-bold text-muted">vs</span>
                            <span className="text-sm font-black text-foreground">
                              {game.awayTeam.shortName}{" "}
                              <span className="text-xs font-normal text-muted">({game.awayScore})</span>
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-2xs text-muted">
                            <span className="flex items-center gap-1">
                              <Calendar size={12} aria-hidden="true" />
                              {formatGameDate(game.startTime)}
                            </span>
                            {game.venue && (
                              <span className="flex items-center gap-1">
                                <MapPin size={12} aria-hidden="true" />
                                {game.venue}
                              </span>
                            )}
                            <Badge tone="neutral">{game.stage}</Badge>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Status Badge & Controls */}
                    <div className="flex flex-wrap items-center gap-2">
                      {item.status === "ingesting" && (
                        <Badge tone="archive" dot>
                          Saving...
                        </Badge>
                      )}

                      {item.status === "saved" && (
                        <Badge tone="success" icon={<CheckCircle2 size={11} aria-hidden="true" />}>
                          Saved to Database
                        </Badge>
                      )}

                      {item.status === "ready" && (
                        <Badge tone="primary" icon={<CheckCircle2 size={11} aria-hidden="true" />}>
                          Ready to Ingest
                        </Badge>
                      )}

                      {game && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(item.id)}
                          aria-expanded={Boolean(item.expanded)}
                          className="inline-flex min-h-10 items-center gap-1 rounded-control border border-border bg-surface-2 px-3 text-2xs font-semibold text-muted transition-colors hover:text-foreground"
                        >
                          {item.expanded ? (
                            <>
                              Hide Box Score <ChevronUp size={13} aria-hidden="true" />
                            </>
                          ) : (
                            <>
                              View Box Score <ChevronDown size={13} aria-hidden="true" />
                            </>
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        disabled={isExtractingAll || isIngestingAll}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-control text-muted transition-colors hover:bg-negative/10 hover:text-negative disabled:opacity-40"
                        title="Remove from queue"
                        aria-label="Remove from queue"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Expandable Box Score Preview */}
                  {item.expanded && game && (
                    <div className="mt-4 flex flex-col gap-3 border-t border-border/50 pt-4">
                      <PreviewBoxTable
                        title={`${game.homeTeam.name} (${(payload?.boxScore.home || game.boxScore.home).length} players)`}
                        items={payload?.boxScore.home || game.boxScore.home}
                        accentColor={game.homeTeam.accentColor}
                        isVolleyball={league === "PVL" || game.league === "PVL"}
                      />

                      <PreviewBoxTable
                        title={`${game.awayTeam.name} (${(payload?.boxScore.away || game.boxScore.away).length} players)`}
                        items={payload?.boxScore.away || game.boxScore.away}
                        accentColor={game.awayTeam.accentColor}
                        isVolleyball={league === "PVL" || game.league === "PVL"}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewBoxTable({
  title,
  items,
  accentColor,
  isVolleyball = false,
}: {
  title: string;
  items: Array<
    | ExtractedBoxRow
    | {
        playerId: string;
        min: string;
        pts: number;
        reb: number;
        ast: number;
        stl: number;
        blk: number;
        to?: number;
        pf?: number;
        fgM: number;
        fgA: number;
        is_libero?: boolean;
      }
  >;
  accentColor: string;
  isVolleyball?: boolean;
}) {
  if (isVolleyball) {
    return (
      <div className="flex flex-col gap-2 rounded-card border border-border bg-surface-2/60 p-3">
        <p className="flex items-center gap-2 text-xs font-bold text-foreground">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} aria-hidden="true" />
          {title}
        </p>

        <TableShell className="shadow-none">
          <table className="w-full min-w-[300px] border-collapse text-left text-2xs">
            <thead>
              <tr>
                <th scope="col" className="w-10 border-b border-border bg-surface-2 px-2 py-2 text-center font-bold text-foreground">#</th>
                <th scope="col" className="border-b border-border bg-surface-2 px-2 py-2 font-bold text-foreground">Player</th>
                <th scope="col" className="w-16 border-b border-border bg-surface-2 px-2 py-2 text-right font-bold text-foreground">PTS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {items.map((row, idx) => {
                const displayName =
                  "playerName" in row && row.playerName
                    ? row.playerName
                    : "playerId" in row && row.playerId
                      ? row.playerId
                      : `Player #${idx + 1}`;
                const jersey = "jersey" in row && row.jersey !== null && row.jersey !== undefined ? row.jersey : null;
                const isLibero = "is_libero" in row && Boolean(row.is_libero);

                return (
                  <tr key={idx} className="transition-colors hover:bg-elevated/50">
                    <td className="w-10 px-2 py-1.5 text-center font-medium tabular-nums text-muted">
                      {jersey !== null ? jersey : "—"}
                    </td>
                    <td className="flex items-center gap-1.5 px-2 py-1.5 font-semibold text-foreground">
                      <span>{displayName}</span>
                      {isLibero && <Badge tone="archive">L</Badge>}
                    </td>
                    <td className="w-16 px-2 py-1.5 text-right font-bold tabular-nums text-foreground">
                      {row.pts}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableShell>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface-2/60 p-3">
      <p className="flex items-center gap-2 text-xs font-bold text-foreground">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} aria-hidden="true" />
        {title}
      </p>

      <TableShell className="shadow-none">
        <table className="w-full min-w-[480px] border-collapse text-left text-2xs">
          <thead>
            <tr>
              <th scope="col" className="border-b border-border bg-surface-2 py-2 font-medium text-muted">Player</th>
              <th scope="col" className="border-b border-border bg-surface-2 px-1 py-2 text-right font-medium text-muted">MIN</th>
              <th scope="col" className="border-b border-border bg-surface-2 px-1 py-2 text-right font-medium text-muted">PTS</th>
              <th scope="col" className="border-b border-border bg-surface-2 px-1 py-2 text-right font-medium text-muted">REB</th>
              <th scope="col" className="border-b border-border bg-surface-2 px-1 py-2 text-right font-medium text-muted">AST</th>
              <th scope="col" className="border-b border-border bg-surface-2 px-1 py-2 text-right font-medium text-muted">STL</th>
              <th scope="col" className="border-b border-border bg-surface-2 px-1 py-2 text-right font-medium text-muted">BLK</th>
              <th scope="col" className="border-b border-border bg-surface-2 px-1 py-2 text-right font-medium text-muted">TO</th>
              <th scope="col" className="border-b border-border bg-surface-2 px-1 py-2 text-right font-medium text-muted">PF</th>
              <th scope="col" className="border-b border-border bg-surface-2 px-1 py-2 text-right font-medium text-muted">FG</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, idx) => {
              const displayName =
                "playerName" in row && row.playerName
                  ? row.playerName
                  : "playerId" in row && row.playerId
                    ? row.playerId
                    : `Player #${idx + 1}`;
              const jersey = "jersey" in row && row.jersey !== null && row.jersey !== undefined ? row.jersey : null;

              return (
                <tr key={idx} className="border-t border-border/40 transition-colors hover:bg-elevated/50">
                  <td className="max-w-[150px] truncate py-1.5 font-semibold text-foreground">
                    <span>{displayName}</span>
                    {jersey !== null && (
                      <span className="ml-1.5 rounded bg-surface-2 px-1 py-0.5 font-mono text-3xs text-muted">
                        #{jersey}
                      </span>
                    )}
                  </td>
                  <td className="px-1 py-1.5 text-right tabular-nums text-muted">{row.min}</td>
                  <td className="px-1 py-1.5 text-right font-bold tabular-nums text-foreground">{row.pts}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums text-muted">{row.reb}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums text-muted">{row.ast}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums text-muted">{row.stl}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums text-muted">{row.blk}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums text-muted">{row.to ?? 0}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums text-muted">{row.pf ?? 0}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums text-muted">
                    {row.fgM}-{row.fgA}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableShell>
    </div>
  );
}

