"use client";

import type { ToastFn } from "@/components/admin/Toast";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { useSportsData } from "@/context/SportsDataContext";
import { generateId } from "@/lib/data";
import { cn, formatRecord } from "@/lib/utils";
import type { League, Team } from "@/types/sports";
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

const LEAGUES: League[] = ["UAAP", "PBA", "PVL"];
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

interface TeamFormState {
  id: string | null;
  name: string;
  shortName: string;
  league: League;
  accentColor: string;
  logo: string;
  wins: string;
  losses: string;
  seasonId: string;
}

function emptyForm(league: League, seasonId: string): TeamFormState {
  return {
    id: null,
    name: "",
    shortName: "",
    league,
    accentColor: "#ff6b35",
    logo: "",
    wins: "0",
    losses: "0",
    seasonId,
  };
}

function teamToForm(team: Team): TeamFormState {
  return {
    id: team.id,
    name: team.name,
    shortName: team.shortName,
    league: team.league,
    accentColor: team.accentColor,
    logo: team.logo ?? "",
    wins: String(team.record.wins),
    losses: String(team.record.losses),
    seasonId: team.seasonId,
  };
}

export function TeamsManager({ onToast }: { onToast: ToastFn }) {
  const { teams: allTeams, seasons, saveTeam, deleteTeam, currentSeasonId } = useSportsData();

  const [seasonFilter, setSeasonFilter] = useState(() => currentSeasonId);
  const [selectedLeague, setSelectedLeague] = useState<League>("UAAP");

  const leagueTeams = allTeams.filter(
    (t) => t.seasonId === seasonFilter && t.league === selectedLeague
  );

  const [selectedTeamId, setSelectedTeamId] = useState<string>("new");

  const currentTeam = leagueTeams.find((t) => t.id === selectedTeamId);

  const [form, setForm] = useState<TeamFormState>(() =>
    currentTeam ? teamToForm(currentTeam) : emptyForm(selectedLeague, seasonFilter)
  );

  function handleLeagueChange(newLeague: League) {
    setSelectedLeague(newLeague);
    setSelectedTeamId("new");
    setForm(emptyForm(newLeague, seasonFilter));
  }

  function handleSeasonChange(nextSeasonId: string) {
    setSeasonFilter(nextSeasonId);
    setSelectedTeamId("new");
    setForm(emptyForm(selectedLeague, nextSeasonId));
  }


  function handleTeamSelect(id: string) {
    setSelectedTeamId(id);
    if (id === "new") {
      setForm(emptyForm(selectedLeague, seasonFilter));
    } else {
      const found = leagueTeams.find((t) => t.id === id);
      if (found) setForm(teamToForm(found));
    }
  }

  function startCreateNew() {
    setSelectedTeamId("new");
    setForm(emptyForm(selectedLeague, seasonFilter));
  }

  function startEditTeam(team: Team) {
    setSelectedTeamId(team.id);
    setForm(teamToForm(team));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.shortName.trim()) {
      onToast("Team name and short name are required.", "error");
      return;
    }

    const id = form.id ?? generateId();
    const team: Team = {
      id,
      name: form.name.trim(),
      shortName: form.shortName.trim().toUpperCase(),
      logo: form.logo.trim() || null,
      league: form.league,
      accentColor: form.accentColor.trim(),
      record: {
        wins: parseInt(form.wins, 10) || 0,
        losses: parseInt(form.losses, 10) || 0,
      },
      seasonId: form.seasonId,
    };

    try {
      await saveTeam(team);
      onToast(form.id ? "Team updated successfully!" : "Team created successfully!");
      setSelectedTeamId(id);
      setForm(teamToForm(team));
    } catch {
      onToast("Failed to save team to database.", "error");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete ${name}? This can't be undone.`)) return;
    try {
      await deleteTeam(id);
      startCreateNew();
      onToast("Team deleted.");
    } catch {
      onToast("Failed to delete team from database.", "error");
    }
  }


  const isValidHex = HEX_COLOR.test(form.accentColor);

  return (
    <div className="flex flex-col gap-5">
      <Field label="Viewing Season">
        <select
          className={selectClass}
          value={seasonFilter}
          onChange={(event) => handleSeasonChange(event.target.value)}
        >
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex items-center gap-1 rounded-full bg-surface p-1">
        {LEAGUES.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => handleLeagueChange(l)}
            className={cn(
              "flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors",
              selectedLeague === l ? "bg-primary text-primary-foreground" : "text-muted"
            )}
          >
            {l}
          </button>
        ))}
      </div>

      <Field label="Select Team to Edit or Add New">
        <select
          className={selectClass}
          value={selectedTeamId}
          onChange={(event) => handleTeamSelect(event.target.value)}
        >
          <option value="new">+ Add New Team</option>
          {leagueTeams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.shortName})
            </option>
          ))}
        </select>
      </Field>

      <SectionCard
        title={form.id ? `Edit ${form.shortName}` : "Create New Team"}
        action={
          form.id ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={startCreateNew}
                className={ghostButtonClass}
              >
                + New Team
              </button>
              <button
                type="button"
                onClick={() => handleDelete(form.id!, form.name)}
                className={dangerButtonClass}
              >
                Delete
              </button>
            </div>
          ) : undefined
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Season">
            <select
              className={selectClass}
              value={form.seasonId}
              onChange={(e) => setForm({ ...form, seasonId: e.target.value })}
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="League">
            <select
              className={selectClass}
              value={form.league}
              onChange={(e) => setForm({ ...form, league: e.target.value as League })}
            >
              {LEAGUES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Full Name">
            <input
              className={inputClass}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="e.g. De La Salle Green Archers"
            />
          </Field>

          <Field label="Short Name / Trigram">
            <input
              className={inputClass}
              value={form.shortName}
              onChange={(event) => setForm({ ...form, shortName: event.target.value })}
              placeholder="e.g. DLSU"
              maxLength={6}
            />
          </Field>

          <Field label="Accent Color (Hex)">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={isValidHex ? form.accentColor : "#ff6b35"}
                onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-surface p-1"
              />
              <input
                className={`${inputClass} flex-1 font-mono`}
                value={form.accentColor}
                onChange={(event) => setForm({ ...form, accentColor: event.target.value })}
                placeholder="#006b35"
              />
            </div>
          </Field>

          <Field label="Logo Image URL (optional)">
            <input
              className={inputClass}
              value={form.logo}
              onChange={(event) => setForm({ ...form, logo: event.target.value })}
              placeholder="https://..."
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Initial Wins">
              <input
                className={inputClass}
                type="number"
                value={form.wins}
                onChange={(event) => setForm({ ...form, wins: event.target.value })}
              />
            </Field>
            <Field label="Initial Losses">
              <input
                className={inputClass}
                type="number"
                value={form.losses}
                onChange={(event) => setForm({ ...form, losses: event.target.value })}
              />
            </Field>
          </div>

          <button type="submit" className={primaryButtonClass}>
            {form.id ? "Save Team Changes" : "Create Team"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title={`${selectedLeague} Teams (${leagueTeams.length})`}>
        {leagueTeams.length === 0 ? (
          <p className="py-4 text-xs text-muted">No teams in this league for the selected season.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {leagueTeams.map((team) => (
              <div
                key={team.id}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-xl border p-2.5 transition-colors",
                  team.id === selectedTeamId
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <TeamBadge team={team} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {team.name} ({team.shortName})
                    </p>
                    <p className="truncate text-[10px] text-muted">
                      Record: {formatRecord(team.record)} &middot; {team.league}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEditTeam(team)}
                    className={ghostButtonClass}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(team.id, team.name)}
                    className={dangerButtonClass}
                  >
                    Delete
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
