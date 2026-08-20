"use client";

import type { ToastFn } from "@/components/admin/Toast";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { useSportsData } from "@/context/SportsDataContext";
import { generateId } from "@/lib/data";
import { cn, formatGameDate, formatStartTime } from "@/lib/utils";
import type { Game, League, TournamentStage } from "@/types/sports";
import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Plus,
  Radio,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Field,
  inputClass,
  primaryButtonClass,
  SectionCard,
  selectClass,
} from "./formPrimitives";


const POPULAR_VENUES: Record<League, string[]> = {
  UAAP: [
    "SM Mall of Asia Arena",
    "Smart Araneta Coliseum",
    "FilOil EcoOil Centre",
    "Ninoy Aquino Stadium",
    "UST Quadricentennial Pavilion",
  ],
  PBA: [
    "Smart Araneta Coliseum",
    "SM Mall of Asia Arena",
    "Ninoy Aquino Stadium",
    "PhilSports Arena",
    "Ynares Center Antipolo",
    "Ynares Sports Arena Pasig",
  ],
  PVL: [
    "PhilSports Arena",
    "Smart Araneta Coliseum",
    "FilOil EcoOil Centre",
    "Rizal Memorial Coliseum",
    "Santa Rosa Sports Complex",
    "Aquilino Q. Pimentel Jr. International Convention Center",
    "MCC Gymnasium, Lanao Del Norte",
  ],
};

const COMMON_TIMES = ["14:00", "16:00", "18:30", "19:30"];

interface DraftFixture {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm (24h)
  homeTeamId: string;
  awayTeamId: string;
  venue: string;
  stage: TournamentStage;
  feedUrl: string;
}

function createEmptyDraft(defaultDate: string, defaultVenue: string): DraftFixture {
  return {
    id: generateId(),
    date: defaultDate,
    time: "16:00",
    homeTeamId: "",
    awayTeamId: "",
    venue: defaultVenue,
    stage: "ELIMINATION",
    feedUrl: "",
  };
}

export function ScheduleManagerTab({ onToast }: { onToast: ToastFn }) {
  const { games, teams, seasons, currentSeasonId, saveGame, deleteGame } = useSportsData();

  // League & Season Selector
  const [selectedLeague, setSelectedLeague] = useState<League>("UAAP");
  const leagueSeasons = useMemo(
    () => seasons.filter((s) => (s.league ? s.league === selectedLeague : s.id.toLowerCase().includes(selectedLeague.toLowerCase()))),
    [seasons, selectedLeague]
  );

  const defaultSeasonId = useMemo(() => {
    const current = leagueSeasons.find((s) => s.isCurrent);
    return current?.id || leagueSeasons[0]?.id || currentSeasonId;
  }, [leagueSeasons, currentSeasonId]);

  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(defaultSeasonId);

  // Active season teams
  const seasonTeams = useMemo(
    () => teams.filter((t) => t.seasonId === selectedSeasonId),
    [teams, selectedSeasonId]
  );

  // Active season upcoming games
  const upcomingGames = useMemo(
    () =>
      games
        .filter((g) => g.seasonId === selectedSeasonId && g.status === "UPCOMING")
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [games, selectedSeasonId]
  );

  const liveGames = useMemo(
    () =>
      games
        .filter((g) => g.seasonId === selectedSeasonId && g.status === "LIVE")
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [games, selectedSeasonId]
  );

  // Draft Fixtures Form State
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const defaultVenue = POPULAR_VENUES[selectedLeague]?.[0] || "PhilSports Arena";

  const [drafts, setDrafts] = useState<DraftFixture[]>([
    createEmptyDraft(todayStr, defaultVenue),
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handlers for drafts
  function addDraftRow() {
    const lastDraft = drafts[drafts.length - 1];
    setDrafts([
      ...drafts,
      createEmptyDraft(lastDraft ? lastDraft.date : todayStr, lastDraft ? lastDraft.venue : defaultVenue),
    ]);
  }

  function removeDraftRow(id: string) {
    if (drafts.length <= 1) {
      setDrafts([createEmptyDraft(todayStr, defaultVenue)]);
      return;
    }
    setDrafts(drafts.filter((d) => d.id !== id));
  }

  function updateDraft(id: string, updates: Partial<DraftFixture>) {
    setDrafts(drafts.map((d) => (d.id === id ? { ...d, ...updates } : d)));
  }

  // Quick Time helper
  function setQuickTime(id: string, time: string) {
    updateDraft(id, { time });
  }

  // Quick Venue helper
  function setQuickVenue(id: string, venue: string) {
    updateDraft(id, { venue });
  }

  // Commit upcoming matches to database
  async function handleSaveAllDrafts() {
    // Validate drafts
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      if (!d.homeTeamId || !d.awayTeamId) {
        onToast(`Match #${i + 1}: Please select both Home and Away teams.`, "error");
        return;
      }
      if (d.homeTeamId === d.awayTeamId) {
        onToast(`Match #${i + 1}: Home and Away teams must be different.`, "error");
        return;
      }
      if (!d.date || !d.time) {
        onToast(`Match #${i + 1}: Please specify match date and time.`, "error");
        return;
      }
    }

    setIsSubmitting(true);
    let savedCount = 0;

    try {
      for (const d of drafts) {
        const homeTeam = seasonTeams.find((t) => t.id === d.homeTeamId);
        const awayTeam = seasonTeams.find((t) => t.id === d.awayTeamId);
        if (!homeTeam || !awayTeam) continue;

        // Construct ISO Start Time
        const [y, m, day] = d.date.split("-").map(Number);
        const [hh, mm] = d.time.split(":").map(Number);
        // Save in Philippine Time (+08:00) UTC representation
        const startTime = new Date(Date.UTC(y, m - 1, day, hh - 8, mm)).toISOString();

        const gameId = `${selectedLeague.toLowerCase()}-${selectedSeasonId}-${homeTeam.shortName.toLowerCase()}-vs-${awayTeam.shortName.toLowerCase()}-${d.date}`;

        const newUpcomingGame: Game = {
          id: gameId,
          league: selectedLeague,
          seasonId: selectedSeasonId,
          homeTeam,
          awayTeam,
          homeScore: 0,
          awayScore: 0,
          status: "UPCOMING",
          quarterOrSet: 1,
          timeRemaining: null,
          startTime,
          venue: d.venue.trim() || defaultVenue,
          stage: d.stage,
          isPlayoff: d.stage !== "ELIMINATION",
          boxScore: { home: [], away: [] },
          playByPlay: [],
        };

        await saveGame(newUpcomingGame);
        savedCount++;
      }

      if (savedCount > 0) {
        onToast(`Successfully scheduled ${savedCount} upcoming match${savedCount > 1 ? "es" : ""}!`, "success");
        setDrafts([createEmptyDraft(todayStr, defaultVenue)]);
      } else {
        onToast("Failed to save matches to database.", "error");
      }
    } catch (err) {
      console.error(err);
      onToast("An error occurred while saving fixtures.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Quick Action: Transition upcoming game to LIVE
  async function handleGoLive(game: Game) {
    try {
      const updated: Game = {
        ...game,
        status: "LIVE",
        quarterOrSet: 1,
        timeRemaining: game.league === "PVL" ? null : "10:00",
      };
      await saveGame(updated);
      onToast(`Match ${game.homeTeam.shortName} vs ${game.awayTeam.shortName} is now LIVE! 🔴`, "success");
    } catch (err) {
      console.error(err);
      onToast("Failed to start match.", "error");
    }
  }

  // Quick Action: Delete fixture
  async function handleDeleteGame(game: Game) {
    if (!confirm(`Are you sure you want to delete ${game.homeTeam.shortName} vs ${game.awayTeam.shortName} from the schedule?`)) {
      return;
    }
    try {
      await deleteGame(game.id);
      onToast("Match removed from schedule.", "success");
    } catch (err) {
      console.error(err);
      onToast("Failed to delete match.", "error");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Filter Bar: League & Season */}
      <SectionCard title="Fixture League & Season">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="League">
            <select
              value={selectedLeague}
              onChange={(e) => {
                const nextLeague = e.target.value as League;
                setSelectedLeague(nextLeague);
                const nextSeason = seasons.find((s) => s.league === nextLeague || s.id.includes(nextLeague.toLowerCase()));
                if (nextSeason) setSelectedSeasonId(nextSeason.id);
              }}
              className={selectClass}
            >
              <option value="UAAP">UAAP Basketball</option>
              <option value="PBA">PBA Basketball</option>
              <option value="PVL">PVL Volleyball</option>
            </select>
          </Field>

          <Field label="Season / Tournament">
            <select
              value={selectedSeasonId}
              onChange={(e) => setSelectedSeasonId(e.target.value)}
              className={selectClass}
            >
              {leagueSeasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} {s.isCurrent ? " (Current)" : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </SectionCard>


      {/* Multi-Match Batch Creator */}
      <SectionCard title={`Batch Schedule Builder (${drafts.length} Match${drafts.length > 1 ? "es" : ""})`}>
        <div className="flex flex-col gap-5">

          {drafts.map((draft, index) => (
            <div
              key={draft.id}
              className="relative flex flex-col gap-4 rounded-2xl border border-border bg-surface/50 p-4 transition-all hover:border-primary/30"
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] text-primary">
                    {index + 1}
                  </span>
                  Match #{index + 1} Fixture
                </span>

                {drafts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeDraftRow(draft.id)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 size={13} />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              {/* Match Date, Time, and Presets */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                <div className="sm:col-span-4">
                  <Field label="Match Date">
                    <input
                      type="date"
                      value={draft.date}
                      onChange={(e) => updateDraft(draft.id, { date: e.target.value })}
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="sm:col-span-3">
                  <Field label="Tip-off Time">
                    <input
                      type="time"
                      value={draft.time}
                      onChange={(e) => updateDraft(draft.id, { time: e.target.value })}
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="sm:col-span-5 flex flex-col justify-end">
                  <span className="mb-1.5 text-[11px] font-semibold text-muted">Quick Times</span>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_TIMES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setQuickTime(draft.id, t)}
                        className={cn(
                          "rounded-lg border px-2 py-1 text-xs font-medium transition-colors",
                          draft.time === t
                            ? "border-primary bg-primary/20 text-foreground font-bold"
                            : "border-border bg-surface text-muted hover:border-border/80"
                        )}
                      >
                        {t === "14:00" ? "2:00 PM" : t === "16:00" ? "4:00 PM" : t === "18:30" ? "6:30 PM" : "7:30 PM"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Team Matchup */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Home Team">
                  <select
                    value={draft.homeTeamId}
                    onChange={(e) => updateDraft(draft.id, { homeTeamId: e.target.value })}
                    className={selectClass}
                  >
                    <option value="">-- Select Home Team --</option>
                    {seasonTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.shortName})
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Away Team">
                  <select
                    value={draft.awayTeamId}
                    onChange={(e) => updateDraft(draft.id, { awayTeamId: e.target.value })}
                    className={selectClass}
                  >
                    <option value="">-- Select Away Team --</option>
                    {seasonTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.shortName})
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Venue & Quick Venue Chips */}
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <Field label="Venue / Location">
                      <input
                        type="text"
                        placeholder="e.g. Smart Araneta Coliseum"
                        value={draft.venue}
                        onChange={(e) => updateDraft(draft.id, { venue: e.target.value })}
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  <Field label="Tournament Stage">
                    <select
                      value={draft.stage}
                      onChange={(e) => updateDraft(draft.id, { stage: e.target.value as TournamentStage })}
                      className={selectClass}
                    >
                      <option value="ELIMINATION">Elimination Round</option>
                      <option value="PLAY_IN">Play-in Tournament</option>
                      <option value="SEMIFINALS">Semifinals / Final Four</option>
                      <option value="FINALS">Championship Finals</option>
                    </select>
                  </Field>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-muted flex items-center gap-1">
                    <MapPin size={11} /> Top Venues:
                  </span>
                  {(POPULAR_VENUES[selectedLeague] || []).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setQuickVenue(draft.id, v)}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                        draft.venue === v
                          ? "border-primary bg-primary/20 font-bold text-foreground"
                          : "border-border bg-surface text-muted hover:border-border/80"
                      )}
                    >
                      {v.split(",")[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-4">
            <button
              type="button"
              onClick={addDraftRow}
              className="flex items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-2.5 text-xs font-semibold text-foreground hover:border-primary/60 hover:bg-primary/5 transition-colors"
            >
              <Plus size={14} />
              <span>Add Another Match</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAllDrafts}
              disabled={isSubmitting}
              className={cn(primaryButtonClass, "px-6 py-2.5 text-xs font-bold shadow-lg shadow-primary/20")}
            >
              {isSubmitting ? (
                "Saving Fixtures..."
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  Save {drafts.length} Upcoming Fixture{drafts.length > 1 ? "s" : ""} to Database
                </>
              )}
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Active Live Games Section (if any) */}
      {liveGames.length > 0 && (
        <SectionCard title={`Active Live Matches (${liveGames.length})`}>
          <div className="flex flex-col gap-3">
            {liveGames.map((game) => (
              <div
                key={game.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-950/10 p-3.5"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-2.5 w-2.5 animate-ping rounded-full bg-rose-500" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-foreground">
                      {game.homeTeam.shortName} <span className="text-muted font-normal text-[11px]">({game.homeScore})</span>
                    </span>
                    <span className="text-xs text-muted">vs</span>
                    <span className="text-xs font-black text-foreground">
                      {game.awayTeam.shortName} <span className="text-muted font-normal text-[11px]">({game.awayScore})</span>
                    </span>
                  </div>
                  <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                    LIVE
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted">
                  <MapPin size={12} />
                  <span>{game.venue}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Scheduled Upcoming Games List */}
      <SectionCard title={`Scheduled Upcoming Matches (${upcomingGames.length})`}>
        {upcomingGames.length === 0 ? (

          <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted">
            No upcoming matches currently scheduled for this season. Use the Schedule Builder above to add upcoming fixtures.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {upcomingGames.map((game) => (
              <div
                key={game.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface/60 p-4 transition-all hover:border-border/90"
              >
                {/* Matchup & Badges */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <TeamBadge team={game.homeTeam} size="sm" />
                    <span className="text-xs font-bold text-foreground">{game.homeTeam.shortName}</span>
                    <span className="text-[11px] font-medium text-muted">vs</span>
                    <TeamBadge team={game.awayTeam} size="sm" />
                    <span className="text-xs font-bold text-foreground">{game.awayTeam.shortName}</span>
                  </div>

                  {game.stage && game.stage !== "ELIMINATION" && (
                    <span className="rounded-md bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold text-primary uppercase">
                      {game.stage}
                    </span>
                  )}
                </div>

                {/* Date, Time & Venue */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} className="text-muted" />
                    <strong className="text-foreground">{formatGameDate(game.startTime, false)}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="text-muted" />
                    <span>{formatStartTime(game.startTime)}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin size={12} className="text-muted" />
                    <span className="max-w-[160px] truncate">{game.venue || "TBD"}</span>
                  </span>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleGoLive(game)}
                    className="flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition-colors"
                    title="Start match now as LIVE"
                  >
                    <Radio size={12} />
                    <span>Start Match 🔴</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteGame(game)}
                    className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                    title="Delete fixture from schedule"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
