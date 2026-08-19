"use client";

import type { ToastFn } from "@/components/admin/Toast";
import { useSportsData } from "@/context/SportsDataContext";
import { cn } from "@/lib/utils";
import type { BoxScoreItem, Game, League, TournamentStage } from "@/types/sports";
import { CheckCircle2, Globe, Loader2, Sparkles } from "lucide-react";

import { useState } from "react";
import { Field, inputClass, primaryButtonClass, SectionCard, selectClass } from "./formPrimitives";

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

const URL_EXAMPLES: Record<League, string> = {
  UAAP: "https://uaap.livestats.ph/tournaments/uaap-season-87-men-s-basketball?game_id=4578",
  PBA: "https://pba-api01.actech2.com/tournaments/pba-50th-season-commissioner-s-cup?game_id=1234",
  PVL: "https://pvl.ph/players (Match Sheet / PDF Link)",
};

export function GameImporterTab({ onToast }: { onToast: ToastFn }) {
  const { seasons, refreshData } = useSportsData();
  const [league, setLeague] = useState<League>("UAAP");
  const [stage, setStage] = useState<TournamentStage>("ELIMINATION");
  const [status, setStatus] = useState<"FINAL" | "LIVE" | "UPCOMING">("FINAL");
  const [url, setUrl] = useState("");

  const leagueSeasons = seasons.filter(
    (s) => s.league === league || (league === "UAAP" && !s.id.startsWith("pba") && !s.id.startsWith("pvl"))
  );

  const [seasonId, setSeasonId] = useState<string>(() => {
    return leagueSeasons.find((s) => s.isCurrent)?.id ?? leagueSeasons[0]?.id ?? "2024-25";
  });

  const [loading, setLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [previewGame, setPreviewGame] = useState<Game | null>(null);
  const [, setPreviewRaw] = useState<Record<string, unknown> | null>(null);


  function handleLeagueChange(newLeague: League) {
    setLeague(newLeague);
    const targetSeasons = seasons.filter(
      (s) => s.league === newLeague || (newLeague === "UAAP" && !s.id.startsWith("pba") && !s.id.startsWith("pvl"))
    );
    const curr = targetSeasons.find((s) => s.isCurrent)?.id ?? targetSeasons[0]?.id ?? "";
    setSeasonId(curr);
    setPreviewGame(null);
    setPreviewRaw(null);
  }

  async function handleFetchPreview() {
    if (!url.trim()) {
      onToast("Please enter a game URL or match link.", "error");
      return;
    }
    if (!seasonId) {
      onToast("Please select a target season.", "error");
      return;
    }

    setLoading(true);
    setPreviewGame(null);
    setPreviewRaw(null);

    try {
      const res = await fetch("/api/admin/ingest-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
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

      setPreviewGame(data.game);
      setPreviewRaw(data);
      onToast("Match data extracted successfully! Review the preview below.");
    } catch (err: unknown) {
      const e = err as { message: string };
      console.error("[GameImporter] Preview Error:", e);
      onToast(e.message || "Failed to extract game data.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmIngest() {
    if (!url.trim() || !seasonId) return;

    setIngesting(true);
    try {
      const res = await fetch("/api/admin/ingest-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          league,
          seasonId,
          stage,
          status,
          previewOnly: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.details || "Ingestion failed.");
      }

      await refreshData();
      onToast(
        `Game ingested successfully! (${data.matchedHomePlayerCount} home, ${data.matchedAwayPlayerCount} away lines saved)`
      );
      setPreviewGame(null);
      setPreviewRaw(null);
      setUrl("");
    } catch (err: unknown) {
      const e = err as { message: string };
      console.error("[GameImporter] Ingest Error:", e);
      onToast(e.message || "Failed to save game to database.", "error");
    } finally {
      setIngesting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        title="LiveStats & PDF Match Ingestion Engine"
        action={
          <span className="flex items-center gap-1 text-[11px] font-semibold text-primary">
            <Sparkles size={13} />
            Auto-Extractor
          </span>
        }
      >
        <p className="text-xs text-muted">
          Paste a LiveStats game URL or match report link. The python extractor will scrape the box score,
          resolve team identities, match roster players, and calculate shooting splits automatically.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <div className="flex items-center gap-1 rounded-full bg-surface p-1">
            {LEAGUES.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => handleLeagueChange(l)}
                className={cn(
                  "flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors",
                  league === l ? "bg-primary text-primary-foreground" : "text-muted"
                )}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Season">
              <select
                className={selectClass}
                value={seasonId}
                onChange={(e) => setSeasonId(e.target.value)}
              >
                {leagueSeasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Tournament Stage">
              <select
                className={selectClass}
                value={stage}
                onChange={(e) => setStage(e.target.value as TournamentStage)}
              >
                {STAGES.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Game Status">
              <select
                className={selectClass}
                value={status}
                onChange={(e) => setStatus(e.target.value as "FINAL" | "LIVE" | "UPCOMING")}

              >
                {STATUSES.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Match URL / Link">
            <div className="flex flex-col gap-1.5">
              <div className="relative">
                <input
                  type="url"
                  className={cn(inputClass, "pl-9 font-mono text-xs")}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={URL_EXAMPLES[league]}
                />
                <Globe size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              </div>
              <p className="text-[10px] text-muted">
                Supported: UAAP LiveStats (`uaap.livestats.ph`), PBA LiveStats (`actech2.com`), and PVL sources.
              </p>
            </div>
          </Field>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={loading || ingesting}
              onClick={handleFetchPreview}
              className={cn(
                primaryButtonClass,
                "flex items-center justify-center gap-2 py-2.5",
                loading && "opacity-70 cursor-not-allowed"
              )}
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Extracting Match Data...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Fetch &amp; Preview Match
                </>
              )}
            </button>
          </div>
        </div>
      </SectionCard>

      {previewGame && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
          <SectionCard
            title="Match Preview & Validation"
            action={
              <button
                type="button"
                disabled={ingesting}
                onClick={handleConfirmIngest}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow hover:bg-primary/90 transition-all active:scale-[0.98]"
              >
                {ingesting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Saving to DB...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} />
                    Confirm &amp; Ingest Game
                  </>
                )}
              </button>
            }
          >
            {/* Header / Score Banner */}
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-elevated p-4">
              <div className="flex items-center justify-between text-xs text-muted">
                <span className="font-semibold uppercase tracking-wide">
                  {previewGame.stage} &bull; {previewGame.league}
                </span>
                <span>{new Date(previewGame.startTime).toLocaleDateString()}</span>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div
                    className="h-9 w-9 rounded-full border-2 flex items-center justify-center text-xs font-bold bg-surface"
                    style={{ borderColor: previewGame.homeTeam.accentColor }}
                  >
                    {previewGame.homeTeam.shortName}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{previewGame.homeTeam.name}</p>
                    <p className="text-[11px] text-muted">Home</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-2xl font-black tabular-nums text-foreground">
                  <span>{previewGame.homeScore}</span>
                  <span className="text-muted text-sm">-</span>
                  <span>{previewGame.awayScore}</span>
                </div>

                <div className="flex items-center gap-3 text-right">
                  <div>
                    <p className="text-sm font-bold text-foreground">{previewGame.awayTeam.name}</p>
                    <p className="text-[11px] text-muted">Away</p>
                  </div>
                  <div
                    className="h-9 w-9 rounded-full border-2 flex items-center justify-center text-xs font-bold bg-surface"
                    style={{ borderColor: previewGame.awayTeam.accentColor }}
                  >
                    {previewGame.awayTeam.shortName}
                  </div>
                </div>
              </div>

              {previewGame.venue && (
                <p className="border-t border-border/60 pt-2 text-center text-[11px] text-muted">
                  Venue: {previewGame.venue}
                </p>
              )}
            </div>

            {/* Box Scores */}
            <div className="mt-4 flex flex-col gap-4">
              <PreviewBoxTable
                title={`${previewGame.homeTeam.shortName} Box Score (${previewGame.boxScore.home.length} players)`}
                items={previewGame.boxScore.home}
                accentColor={previewGame.homeTeam.accentColor}
              />

              <PreviewBoxTable
                title={`${previewGame.awayTeam.shortName} Box Score (${previewGame.boxScore.away.length} players)`}
                items={previewGame.boxScore.away}
                accentColor={previewGame.awayTeam.accentColor}
              />
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

function PreviewBoxTable({
  title,
  items,
  accentColor,
}: {
  title: string;
  items: BoxScoreItem[];
  accentColor: string;
}) {
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
            {items.map((row, idx) => (
              <tr key={idx} className="border-t border-border/40 hover:bg-elevated/50 transition-colors">
                <td className="max-w-[130px] truncate py-1.5 font-semibold text-foreground">
                  {row.playerId || `Player #${idx + 1}`}
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
