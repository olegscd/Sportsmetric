"use client";

import type { ToastFn } from "@/components/admin/Toast";
import { useSportsData } from "@/context/SportsDataContext";
import type { ExtractedBoxRow, ExtractedGamePayload } from "@/lib/game-extractor";
import { cn } from "@/lib/utils";
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

  const leagueSeasons = seasons.filter(
    (s) => s.league === league || (league === "UAAP" && !s.id.startsWith("pba") && !s.id.startsWith("pvl"))
  );

  const [seasonId, setSeasonId] = useState<string>(() => {
    return leagueSeasons.find((s) => s.isCurrent)?.id ?? leagueSeasons[0]?.id ?? "pba-gov-cup-50";
  });

  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [isExtractingAll, setIsExtractingAll] = useState(false);
  const [isIngestingAll, setIsIngestingAll] = useState(false);

  // Parse lines from textarea into candidate URLs/IDs
  const parsedUrls = useMemo(() => {
    return urlInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [urlInput]);

  function handleLeagueChange(newLeague: League) {
    setLeague(newLeague);
    const targetSeasons = seasons.filter(
      (s) => s.league === newLeague || (newLeague === "UAAP" && !s.id.startsWith("pba") && !s.id.startsWith("pvl"))
    );
    const curr = targetSeasons.find((s) => s.isCurrent)?.id ?? targetSeasons[0]?.id ?? "";
    setSeasonId(curr);
    setBatchItems([]);
  }

  async function handleBatchExtract() {
    if (parsedUrls.length === 0) {
      onToast("Please enter at least one game URL or match ID.", "error");
      return;
    }
    if (!seasonId) {
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
            seasonId,
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
            seasonId,
            stage,
            status,
            previewOnly: false,
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
    setBatchItems((prev) => prev.filter((item) => item.id !== id));
  }

  const readyCount = batchItems.filter((i) => i.status === "ready").length;
  const savedCount = batchItems.filter((i) => i.status === "saved").length;

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        title="Multi-Game LiveStats & Match Ingestion Engine"
        action={
          <span className="flex items-center gap-1 text-[11px] font-semibold text-primary">
            <Sparkles size={13} />
            Batch Importer
          </span>
        }
      >
        <p className="text-xs text-muted">
          Paste one or more LiveStats links, <code className="text-primary font-mono text-[11px]">pba.ph/recap?match=...</code> URLs,
          or raw match IDs (one per line). All matches will be scraped, verified, and saved to the database.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          {/* League Selector */}
          <div className="flex items-center gap-1 rounded-full bg-surface p-1">
            {LEAGUES.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => handleLeagueChange(l)}
                className={cn(
                  "flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors",
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
                value={seasonId}
                onChange={(e) => setSeasonId(e.target.value)}
                disabled={isExtractingAll || isIngestingAll}
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
                disabled={isExtractingAll || isIngestingAll}
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
                disabled={isExtractingAll || isIngestingAll}
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
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 font-mono text-xs text-foreground placeholder:text-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[100px] leading-relaxed"
                placeholder={
                  league === "PBA"
                    ? "https://pba.ph/recap?match=553\nhttps://pba.ph/recap?match=554\n555"
                    : "https://uaap.livestats.ph/tournaments/uaap-season-87-men-s-basketball?game_id=56\n57\n58"
                }
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                disabled={isExtractingAll || isIngestingAll}
              />
            </div>
          </Field>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleBatchExtract}
              disabled={isExtractingAll || isIngestingAll || parsedUrls.length === 0}
              className={cn(
                primaryButtonClass,
                "gap-2 px-5",
                (isExtractingAll || parsedUrls.length === 0) && "opacity-60 cursor-not-allowed"
              )}
            >
              {isExtractingAll ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Extracting Matches...
                </>
              ) : (
                <>
                  <ListPlus size={14} />
                  Fetch & Preview {parsedUrls.length > 0 ? `(${parsedUrls.length}) Matches` : "Matches"}
                </>
              )}
            </button>

            {readyCount > 0 && (
              <button
                type="button"
                onClick={handleIngestAllReady}
                disabled={isIngestingAll || isExtractingAll}
                className={cn(
                  "flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition-all",
                  isIngestingAll && "opacity-60 cursor-not-allowed"
                )}
              >
                {isIngestingAll ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Saving {readyCount} Game{readyCount > 1 ? "s" : ""} to Database...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    Confirm & Ingest All ({readyCount}) Ready Matches
                  </>
                )}
              </button>
            )}

            {savedCount > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <CheckCircle2 size={14} />
                {savedCount} Game{savedCount > 1 ? "s" : ""} saved in Supabase
              </span>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Extracted Matches Preview List */}
      {batchItems.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
              <Layers size={14} />
              Extracted Match Queue ({batchItems.length})
            </h3>
            <span className="text-[11px] text-muted">
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
                    "rounded-2xl border bg-surface/70 backdrop-blur-sm p-4 transition-all",
                    item.status === "saved"
                      ? "border-emerald-500/40 bg-emerald-950/10"
                      : item.status === "error"
                        ? "border-rose-500/40 bg-rose-950/10"
                        : item.status === "ready"
                          ? "border-border hover:border-primary/40"
                          : "border-border opacity-70"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Match Headline */}
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted/20 text-[11px] font-bold text-muted">
                        #{index + 1}
                      </span>

                      {item.status === "extracting" && (
                        <div className="flex items-center gap-2 text-xs text-muted">
                          <Loader2 size={13} className="animate-spin text-primary" />
                          <span>Extracting from: <code className="font-mono text-foreground">{item.rawUrl}</code></span>
                        </div>
                      )}

                      {item.status === "error" && (
                        <div className="flex items-center gap-2 text-xs text-rose-400">
                          <AlertCircle size={14} />
                          <span>
                            <strong className="font-mono">{item.rawUrl}</strong>: {item.error}
                          </span>
                        </div>
                      )}

                      {(item.status === "ready" || item.status === "ingesting" || item.status === "saved") && game && (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-foreground">
                              {game.homeTeam.shortName}{" "}
                              <span className="text-muted font-normal text-xs">({game.homeScore})</span>
                            </span>
                            <span className="text-xs font-bold text-muted">vs</span>
                            <span className="text-sm font-black text-foreground">
                              {game.awayTeam.shortName}{" "}
                              <span className="text-muted font-normal text-xs">({game.awayScore})</span>
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
                            <span className="flex items-center gap-1">
                              <Calendar size={11} />
                              {new Date(game.startTime).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                            {game.venue && (
                              <span className="flex items-center gap-1">
                                <MapPin size={11} />
                                {game.venue}
                              </span>
                            )}
                            <span className="rounded bg-muted/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted">
                              {game.stage}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Status Badge & Controls */}
                    <div className="flex items-center gap-2">
                      {item.status === "ingesting" && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-400">
                          <Loader2 size={11} className="animate-spin" /> Saving...
                        </span>
                      )}

                      {item.status === "saved" && (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400">
                          <CheckCircle2 size={11} /> Saved to Database
                        </span>
                      )}

                      {item.status === "ready" && (
                        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                          <CheckCircle2 size={11} /> Ready to Ingest
                        </span>
                      )}

                      {game && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(item.id)}
                          className="flex items-center gap-1 rounded-lg border border-border/80 bg-surface px-2 py-1 text-[11px] font-semibold text-muted hover:text-foreground transition-colors"
                        >
                          {item.expanded ? (
                            <>
                              Hide Box Score <ChevronUp size={12} />
                            </>
                          ) : (
                            <>
                              View Box Score <ChevronDown size={12} />
                            </>
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        disabled={item.status === "ingesting"}
                        className="rounded-lg p-1 text-muted hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                        title="Remove from queue"
                      >
                        <Trash2 size={13} />
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
    const sumPlayerPts = items.reduce((acc, item) => acc + (item.pts || 0), 0);
    const oppErrors = Math.max(10, Math.round(sumPlayerPts * 0.22));
    const teamTotalPts = sumPlayerPts + oppErrors;

    return (
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
        <p className="text-xs font-bold text-foreground flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
          {title}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[300px] text-left text-[11px]">
            <thead>
              <tr className="border-b border-border text-muted font-semibold uppercase tracking-wider">
                <th className="w-10 py-1.5 px-2 text-center font-bold text-foreground">#</th>
                <th className="py-1.5 px-2 font-bold text-foreground">Player</th>
                <th className="w-16 py-1.5 px-2 text-right font-bold text-foreground">PTS</th>
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
                  <tr key={idx} className="hover:bg-elevated/50 transition-colors">
                    <td className="w-10 py-1.5 px-2 text-center tabular-nums text-muted font-medium">
                      {jersey !== null ? jersey : "—"}
                    </td>
                    <td className="py-1.5 px-2 font-semibold text-foreground flex items-center gap-1.5">
                      <span>{displayName}</span>
                      {isLibero && (
                        <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-bold text-amber-400">
                          L
                        </span>
                      )}
                    </td>
                    <td className="w-16 py-1.5 px-2 text-right tabular-nums font-bold text-foreground">
                      {row.pts}
                    </td>
                  </tr>
                );
              })}

              {/* Opponent Errors */}
              <tr className="bg-surface/30 italic text-muted text-[10px]">
                <td className="w-10 py-1.5 px-2 text-center font-medium">—</td>
                <td className="py-1.5 px-2 font-medium">Opponent Errors</td>
                <td className="w-16 py-1.5 px-2 text-right tabular-nums font-semibold">
                  {oppErrors}
                </td>
              </tr>

              {/* Team Total */}
              <tr className="border-t border-border font-bold bg-surface/50 text-foreground">
                <td className="w-10 py-2 px-2 text-center font-bold">—</td>
                <td className="py-2 px-2 font-bold uppercase tracking-wider text-[10px]">
                  TEAM TOTALS
                </td>
                <td className="w-16 py-2 px-2 text-right tabular-nums font-extrabold text-primary text-xs">
                  {teamTotalPts}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
      <p className="text-xs font-bold text-foreground flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
        {title}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-[11px]">
          <thead>
            <tr className="text-muted border-b border-border">
              <th className="py-1.5 font-medium">Player</th>
              <th className="px-1 py-1.5 text-right font-medium">MIN</th>
              <th className="px-1 py-1.5 text-right font-medium">PTS</th>
              <th className="px-1 py-1.5 text-right font-medium">REB</th>
              <th className="px-1 py-1.5 text-right font-medium">AST</th>
              <th className="px-1 py-1.5 text-right font-medium">STL</th>
              <th className="px-1 py-1.5 text-right font-medium">BLK</th>
              <th className="px-1 py-1.5 text-right font-medium">TO</th>
              <th className="px-1 py-1.5 text-right font-medium">PF</th>
              <th className="px-1 py-1.5 text-right font-medium">FG</th>
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
                <tr key={idx} className="border-t border-border/40 hover:bg-elevated/50 transition-colors">
                  <td className="max-w-[150px] truncate py-1.5 font-semibold text-foreground">
                    <span>{displayName}</span>
                    {jersey !== null && (
                      <span className="ml-1.5 rounded bg-muted/20 px-1 py-0.5 text-[9px] font-mono text-muted">
                        #{jersey}
                      </span>
                    )}
                  </td>
                  <td className="px-1 py-1.5 text-right tabular-nums text-muted">{row.min}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums font-bold text-foreground">{row.pts}</td>
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
      </div>
    </div>
  );
}

