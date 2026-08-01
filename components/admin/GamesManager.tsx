"use client";

import type { ToastFn } from "@/components/admin/Toast";
import { useSportsData } from "@/context/SportsDataContext";
import { generateId } from "@/lib/data";
import type { Game, GameStatus, PlayByPlayEvent, PlayByPlayEventType } from "@/types/sports";
import { useState, type FormEvent } from "react";
import {
  dangerButtonClass,
  Field,
  inputClass,
  labelClass,
  primaryButtonClass,
  SectionCard,
  selectClass,
} from "./formPrimitives";

const STATUSES: GameStatus[] = ["LIVE", "UPCOMING", "FINAL"];

const PBP_TYPES: PlayByPlayEventType[] = [
  "FG_MADE",
  "FG_MISSED",
  "3PT_MADE",
  "FT_MADE",
  "REBOUND",
  "ASSIST",
  "STEAL",
  "BLOCK",
  "TURNOVER",
  "FOUL",
  "SUB",
  "TIMEOUT",
  "PERIOD_END",
  "KILL",
  "SERVE_ACE",
  "BLOCK_POINT",
];

function periodInputDefault(game: Game): string {
  if (game.status === "UPCOMING") return "";
  if (game.timeRemaining) return `Q${game.quarterOrSet} ${game.timeRemaining}`;
  return `Set ${game.quarterOrSet}`;
}

function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function GameQuickRow({
  game,
  onToast,
  onDelete,
  onUpdateScore,
}: {
  game: Game;
  onToast: ToastFn;
  onDelete: (id: string) => void;
  onUpdateScore: (
    id: string,
    homeScore: number,
    awayScore: number,
    status: GameStatus,
    quarterOrSet: number,
    timeRemaining: string | null
  ) => void;
}) {
  const [homeScore, setHomeScore] = useState(String(game.homeScore));
  const [awayScore, setAwayScore] = useState(String(game.awayScore));
  const [status, setStatus] = useState<GameStatus>(game.status);
  const [period, setPeriod] = useState(periodInputDefault(game));

  function handleSave() {
    onUpdateScore(
      game.id,
      parseInt(homeScore, 10) || 0,
      parseInt(awayScore, 10) || 0,
      status,
      1,
      period
    );
    onToast("Score updated successfully!");
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-semibold text-foreground">
          {game.awayTeam.shortName} @ {game.homeTeam.shortName}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[10px] uppercase text-muted">{game.league}</span>
          <button
            type="button"
            onClick={() => onDelete(game.id)}
            className={dangerButtonClass}
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label={`${game.awayTeam.shortName} score`}>
          <input
            className={inputClass}
            type="number"
            value={awayScore}
            onChange={(event) => setAwayScore(event.target.value)}
          />
        </Field>
        <Field label={`${game.homeTeam.shortName} score`}>
          <input
            className={inputClass}
            type="number"
            value={homeScore}
            onChange={(event) => setHomeScore(event.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Status">
          <select
            className={selectClass}
            value={status}
            onChange={(event) => setStatus(event.target.value as GameStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Period / Clock">
          <input
            className={inputClass}
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            placeholder='e.g. "Q4 1:42" or "Set 3"'
          />
        </Field>
      </div>

      <button type="button" onClick={handleSave} className={primaryButtonClass}>
        Save Score
      </button>
    </div>
  );
}

interface FullGameFormState {
  id: string | null;
  homeTeamId: string;
  awayTeamId: string;
  venue: string;
  startTimeLocal: string;
  seasonId: string;
}

function emptyFullForm(
  defaultTeamId: string,
  secondTeamId: string,
  seasonId: string
): FullGameFormState {
  return {
    id: null,
    homeTeamId: defaultTeamId,
    awayTeamId: secondTeamId,
    venue: "",
    startTimeLocal: isoToLocalInput(new Date().toISOString()),
    seasonId,
  };
}

function gameToFullForm(game: Game): FullGameFormState {
  return {
    id: game.id,
    homeTeamId: game.homeTeam.id,
    awayTeamId: game.awayTeam.id,
    venue: game.venue ?? "",
    startTimeLocal: isoToLocalInput(game.startTime),
    seasonId: game.seasonId,
  };
}

export function GamesManager({ onToast }: { onToast: ToastFn }) {
  const {
    games: allGames,
    teams: allTeams,
    seasons,
    saveGame,
    deleteGame,
    updateGameScore,
    currentSeasonId,
  } = useSportsData();

  const [seasonFilter, setSeasonFilter] = useState(() => currentSeasonId);

  const games = allGames.filter((g) => g.seasonId === seasonFilter);
  const teamsInListSeason = allTeams.filter((t) => t.seasonId === seasonFilter);

  const [fullForm, setFullForm] = useState<FullGameFormState>(() =>
    emptyFullForm(
      teamsInListSeason[0]?.id ?? "",
      teamsInListSeason[1]?.id ?? teamsInListSeason[0]?.id ?? "",
      seasonFilter
    )
  );

  const teamsInFormSeason = allTeams.filter((t) => t.seasonId === fullForm.seasonId);

  const [pbp, setPbp] = useState({
    period: "1",
    clock: "",
    description: "",
    type: "FG_MADE" as PlayByPlayEventType,
    scoringSide: "none" as "home" | "away" | "none",
  });

  const editingGame = fullForm.id ? allGames.find((g) => g.id === fullForm.id) : undefined;

  function startCreateGame() {
    setFullForm(
      emptyFullForm(
        teamsInListSeason[0]?.id ?? "",
        teamsInListSeason[1]?.id ?? teamsInListSeason[0]?.id ?? "",
        seasonFilter
      )
    );
  }

  function startEditGame(game: Game) {
    setFullForm(gameToFullForm(game));
  }

  function handleSeasonFilterChange(nextSeasonId: string) {
    setSeasonFilter(nextSeasonId);
    const teamsInNextSeason = allTeams.filter((t) => t.seasonId === nextSeasonId);
    setFullForm(
      emptyFullForm(
        teamsInNextSeason[0]?.id ?? "",
        teamsInNextSeason[1]?.id ?? teamsInNextSeason[0]?.id ?? "",
        nextSeasonId
      )
    );
  }

  function handleFullFormSubmit(event: FormEvent) {
    event.preventDefault();
    const homeTeam = allTeams.find((t) => t.id === fullForm.homeTeamId);
    const awayTeam = allTeams.find((t) => t.id === fullForm.awayTeamId);

    if (!homeTeam || !awayTeam) {
      onToast("Pick both a home and away team.", "error");
      return;
    }
    if (homeTeam.id === awayTeam.id) {
      onToast("Home and away teams must be different.", "error");
      return;
    }

    const startTime = localInputToIso(fullForm.startTimeLocal);
    const existing = fullForm.id ? allGames.find((g) => g.id === fullForm.id) : undefined;

    const game: Game = existing
      ? { ...existing, homeTeam, awayTeam, league: homeTeam.league, venue: fullForm.venue.trim(), startTime }
      : {
          id: generateId(),
          league: homeTeam.league,
          homeTeam,
          awayTeam,
          homeScore: 0,
          awayScore: 0,
          status: "UPCOMING",
          quarterOrSet: 0,
          timeRemaining: null,
          startTime,
          venue: fullForm.venue.trim(),
          playByPlay: [],
          boxScore: { home: [], away: [] },
          seasonId: fullForm.seasonId,
        };

    void saveGame(game);
    onToast(fullForm.id ? "Game updated successfully!" : "Game created successfully!");
    setFullForm(gameToFullForm(game));
  }

  function handleDeleteGame(id: string) {
    if (!window.confirm("Delete this game? This can't be undone.")) return;
    void deleteGame(id);
    if (fullForm.id === id) startCreateGame();
    onToast("Game deleted.");
  }

  function handleAddPbpEvent() {
    if (!editingGame) return;
    if (!pbp.description.trim()) {
      onToast("Add a description for the play-by-play event.", "error");
      return;
    }

    const scoringTeamId =
      pbp.scoringSide === "home"
        ? editingGame.homeTeam.id
        : pbp.scoringSide === "away"
          ? editingGame.awayTeam.id
          : null;

    const event: PlayByPlayEvent = {
      id: generateId(),
      timestamp: pbp.clock.trim() || "00:00",
      period: parseInt(pbp.period, 10) || 1,
      description: pbp.description.trim(),
      scoringTeamId,
      currentScore: { home: editingGame.homeScore, away: editingGame.awayScore },
      type: pbp.type,
    };

    void saveGame({ ...editingGame, playByPlay: [...editingGame.playByPlay, event] });
    setPbp({ ...pbp, description: "" });
    onToast("Play-by-play event added.");
  }

  return (
    <div className="flex flex-col gap-6">
      <Field label="Viewing Season">
        <select
          className={selectClass}
          value={seasonFilter}
          onChange={(event) => handleSeasonFilterChange(event.target.value)}
        >
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.label}
            </option>
          ))}
        </select>
      </Field>

      <SectionCard title="Quick Live Score Update">
        {games.length === 0 ? (
          <p className="text-xs text-muted">No games for this season yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {games.map((g) => (
              <GameQuickRow
                key={g.id}
                game={g}
                onToast={onToast}
                onDelete={handleDeleteGame}
                onUpdateScore={updateGameScore}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={fullForm.id ? "Edit Game Details" : "Create New Game"}
        action={
          fullForm.id ? (
            <button type="button" onClick={startCreateGame} className={primaryButtonClass}>
              + New Game
            </button>
          ) : undefined
        }
      >
        <form onSubmit={handleFullFormSubmit} className="flex flex-col gap-3">
          <Field label="Season">
            <select
              className={selectClass}
              value={fullForm.seasonId}
              onChange={(e) =>
                setFullForm({
                  ...fullForm,
                  seasonId: e.target.value,
                  homeTeamId:
                    allTeams.filter((t) => t.seasonId === e.target.value)[0]?.id ?? "",
                  awayTeamId:
                    allTeams.filter((t) => t.seasonId === e.target.value)[1]?.id ?? "",
                })
              }
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Home Team">
              <select
                className={selectClass}
                value={fullForm.homeTeamId}
                onChange={(e) => setFullForm({ ...fullForm, homeTeamId: e.target.value })}
              >
                {teamsInFormSeason.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.shortName})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Away Team">
              <select
                className={selectClass}
                value={fullForm.awayTeamId}
                onChange={(e) => setFullForm({ ...fullForm, awayTeamId: e.target.value })}
              >
                {teamsInFormSeason.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.shortName})
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Venue">
            <input
              className={inputClass}
              value={fullForm.venue}
              onChange={(e) => setFullForm({ ...fullForm, venue: e.target.value })}
              placeholder="e.g. Smart Araneta Coliseum"
            />
          </Field>

          <Field label="Start Date & Time">
            <input
              className={inputClass}
              type="datetime-local"
              value={fullForm.startTimeLocal}
              onChange={(e) => setFullForm({ ...fullForm, startTimeLocal: e.target.value })}
            />
          </Field>

          <button type="submit" className={primaryButtonClass}>
            {fullForm.id ? "Update Game Info" : "Create Game"}
          </button>
        </form>
      </SectionCard>

      {editingGame && (
        <SectionCard title={`Add Play-by-Play Event (${editingGame.awayTeam.shortName} @ ${editingGame.homeTeam.shortName})`}>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Period / Qtr / Set">
                <input
                  className={inputClass}
                  type="number"
                  value={pbp.period}
                  onChange={(e) => setPbp({ ...pbp, period: e.target.value })}
                />
              </Field>
              <Field label="Clock (e.g. 08:30)">
                <input
                  className={inputClass}
                  value={pbp.clock}
                  onChange={(e) => setPbp({ ...pbp, clock: e.target.value })}
                  placeholder="08:30"
                />
              </Field>
            </div>

            <Field label="Event Type">
              <select
                className={selectClass}
                value={pbp.type}
                onChange={(e) => setPbp({ ...pbp, type: e.target.value as PlayByPlayEventType })}
              >
                {PBP_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Scoring Team">
              <select
                className={selectClass}
                value={pbp.scoringSide}
                onChange={(e) => setPbp({ ...pbp, scoringSide: e.target.value as "home" | "away" | "none" })}
              >
                <option value="none">None (Non-scoring event)</option>
                <option value="home">{editingGame.homeTeam.name} (Home)</option>
                <option value="away">{editingGame.awayTeam.name} (Away)</option>
              </select>
            </Field>

            <Field label="Description">
              <input
                className={inputClass}
                value={pbp.description}
                onChange={(e) => setPbp({ ...pbp, description: e.target.value })}
                placeholder="e.g. Quiambao 3-pt jump shot made"
              />
            </Field>

            <button type="button" onClick={handleAddPbpEvent} className={primaryButtonClass}>
              Add Play Event
            </button>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
