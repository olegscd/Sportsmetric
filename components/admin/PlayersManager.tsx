"use client";

import type { ToastFn } from "@/components/admin/Toast";
import { useSportsData } from "@/context/SportsDataContext";
import { generateId } from "@/lib/data";
import type { Player, Position, RankBadge } from "@/types/sports";
import { useState, type FormEvent } from "react";
import {
  dangerButtonClass,
  Field,
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  SectionCard,
  selectClass,
} from "./formPrimitives";

const POSITIONS: Position[] = ["PG", "SG", "SF", "PF", "C", "OH", "OP", "MB", "S", "L"];

interface PlayerFormState {
  id: string | null;
  personId: string;
  name: string;
  jerseyNumber: string;
  position: Position;
  teamId: string;
  height: string;
  photoUrl: string;
  ppg: string;
  rpg: string;
  apg: string;
  spg: string;
  bpg: string;
  fgPct: string;
  threePtPct: string;
  ftPct: string;
  killsPerSet: string;
  digsPerSet: string;
  blocksPerSet: string;
  rankBadges: string;
  seasonId: string;
}

function emptyForm(defaultTeamId: string, seasonId: string): PlayerFormState {
  return {
    id: null,
    personId: "",
    name: "",
    jerseyNumber: "",
    position: "PG",
    teamId: defaultTeamId,
    height: "",
    photoUrl: "",
    ppg: "0",
    rpg: "0",
    apg: "0",
    spg: "0",
    bpg: "0",
    fgPct: "0",
    threePtPct: "0",
    ftPct: "0",
    killsPerSet: "0",
    digsPerSet: "0",
    blocksPerSet: "0",
    rankBadges: "",
    seasonId,
  };
}

function playerToForm(player: Player): PlayerFormState {
  const avg = player.seasonAverages;
  return {
    id: player.id,
    personId: player.personId,
    name: player.name,
    jerseyNumber: String(player.jerseyNumber),
    position: player.position,
    teamId: player.teamId,
    height: player.height,
    photoUrl: player.photoUrl ?? "",
    ppg: String(avg.ppg),
    rpg: String(avg.rpg),
    apg: String(avg.apg),
    spg: String(avg.spg),
    bpg: String(avg.bpg),
    fgPct: String(avg.fgPct),
    threePtPct: String(avg.threePtPct),
    ftPct: String(avg.ftPct),
    killsPerSet: String(avg.killsPerSet ?? 0),
    digsPerSet: String(avg.digsPerSet ?? 0),
    blocksPerSet: String(avg.blocksPerSet ?? 0),
    rankBadges: player.rankBadges.map((b) => b.label).join(", "),
    seasonId: player.seasonId,
  };
}

function toNumber(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

interface ParsedPlayerRow {
  jerseyNumber: number;
  name: string;
  position: Position;
  height: string;
}

function parseBulkRosterText(text: string): ParsedPlayerRow[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const results: ParsedPlayerRow[] = [];
  const posList: Position[] = ["PG", "SG", "SF", "PF", "C", "OH", "OP", "MB", "S", "L"];

  for (const line of lines) {
    const parts = line.split(/[|,\t]+/).map((p) => p.trim()).filter(Boolean);
    let jerseyNumber = 0;
    let name = "";
    let position: Position = "PG";
    let height = "";

    if (parts.length >= 2) {
      const maybeNum = parseInt(parts[0].replace("#", ""), 10);
      if (!isNaN(maybeNum)) {
        jerseyNumber = maybeNum;
        name = parts[1];
        if (parts[2]) {
          const foundPos = posList.find((p) => p.toLowerCase() === parts[2].toLowerCase());
          if (foundPos) position = foundPos;
        }
        if (parts[3]) height = parts[3];
      } else {
        name = parts[0];
        const foundPos = posList.find((p) => p.toLowerCase() === parts[1].toLowerCase());
        if (foundPos) position = foundPos;
        if (parts[2]) height = parts[2];
      }
    } else {
      const tokens = line.split(/\s+/);
      const maybeNum = parseInt(tokens[0].replace("#", ""), 10);
      if (!isNaN(maybeNum)) {
        jerseyNumber = maybeNum;
        name = tokens.slice(1).join(" ");
      } else {
        name = line;
      }
      const lastToken = tokens[tokens.length - 1]?.toUpperCase() as Position;
      if (posList.includes(lastToken)) {
        position = lastToken;
        if (!isNaN(maybeNum)) {
          name = tokens.slice(1, -1).join(" ");
        } else {
          name = tokens.slice(0, -1).join(" ");
        }
      }
    }

    if (name) {
      results.push({ jerseyNumber, name, position, height });
    }
  }

  return results;
}

export function PlayersManager({ onToast }: { onToast: ToastFn }) {
  const {
    players: allPlayers,
    teams: allTeams,
    seasons,
    savePlayer,
    deletePlayer,
    deleteAllPlayers,
    currentSeasonId,
  } = useSportsData();

  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");
  const [seasonFilter, setSeasonFilter] = useState(() => currentSeasonId);
  const [form, setForm] = useState<PlayerFormState>(() =>
    emptyForm(
      allTeams.find((t) => t.seasonId === seasonFilter)?.id ?? "",
      seasonFilter
    )
  );

  const [quickTeamId, setQuickTeamId] = useState<string>("");
  const [quickName, setQuickName] = useState("");
  const [quickJersey, setQuickJersey] = useState("");
  const [quickPos, setQuickPos] = useState<Position>("PG");
  const [quickHeight, setQuickHeight] = useState("");

  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const teamsInListSeason = allTeams.filter((t) => t.seasonId === seasonFilter);
  const teamsInFormSeason = allTeams.filter((t) => t.seasonId === form.seasonId);
  const players = allPlayers.filter((p) => p.seasonId === seasonFilter);

  const activeQuickTeamId = quickTeamId || teamsInListSeason[0]?.id || "";
  const isVolleyball = allTeams.find((t) => t.id === (form.teamId || activeQuickTeamId))?.league === "PVL";

  const filteredPlayers = players.filter((player) => {
    const matchesSearch = player.name.toLowerCase().includes(search.trim().toLowerCase());
    const matchesTeam = teamFilter === "ALL" || player.teamId === teamFilter;
    return matchesSearch && matchesTeam;
  });

  function startCreate() {
    setForm(emptyForm(teamsInListSeason[0]?.id ?? "", seasonFilter));
  }

  function startEdit(player: Player) {
    setForm(playerToForm(player));
  }

  function handleSeasonFilterChange(nextSeasonId: string) {
    setSeasonFilter(nextSeasonId);
    setTeamFilter("ALL");
    const teamsInNextSeason = allTeams.filter((t) => t.seasonId === nextSeasonId);
    setForm(emptyForm(teamsInNextSeason[0]?.id ?? "", nextSeasonId));
    setQuickTeamId(teamsInNextSeason[0]?.id ?? "");
  }

  function handleQuickRowAdd(event: FormEvent) {
    event.preventDefault();
    if (!quickName.trim()) {
      onToast("Player name is required.", "error");
      return;
    }
    const teamId = activeQuickTeamId;
    if (!teamId) {
      onToast("Please select a target team.", "error");
      return;
    }

    const id = generateId();
    const player: Player = {
      id,
      personId: id,
      name: quickName.trim(),
      jerseyNumber: parseInt(quickJersey, 10) || 0,
      position: quickPos,
      teamId,
      height: quickHeight.trim(),
      photoUrl: null,
      seasonAverages: {
        ppg: 0,
        rpg: 0,
        apg: 0,
        spg: 0,
        bpg: 0,
        fgPct: 0,
        threePtPct: 0,
        ftPct: 0,
        ...(isVolleyball ? { killsPerSet: 0, digsPerSet: 0, blocksPerSet: 0 } : {}),
      },
      rankBadges: [],
      seasonId: seasonFilter,
    };

    void savePlayer(player);
    onToast(`Added ${player.name} to roster!`);
    setQuickName("");
    const nextJersey = (parseInt(quickJersey, 10) || 0) + 1;
    setQuickJersey(nextJersey > 0 ? String(nextJersey) : "");
  }

  function handleBulkImport() {
    const parsed = parseBulkRosterText(bulkText);
    if (parsed.length === 0) {
      onToast("No valid player rows found in text.", "error");
      return;
    }
    const targetTeamId = activeQuickTeamId;
    if (!targetTeamId) {
      onToast("Select a target team first.", "error");
      return;
    }

    let count = 0;
    for (const item of parsed) {
      const id = generateId();
      const player: Player = {
        id,
        personId: id,
        name: item.name,
        jerseyNumber: item.jerseyNumber,
        position: item.position,
        teamId: targetTeamId,
        height: item.height,
        photoUrl: null,
        seasonAverages: {
          ppg: 0,
          rpg: 0,
          apg: 0,
          spg: 0,
          bpg: 0,
          fgPct: 0,
          threePtPct: 0,
          ftPct: 0,
          ...(isVolleyball ? { killsPerSet: 0, digsPerSet: 0, blocksPerSet: 0 } : {}),
        },
        rankBadges: [],
        seasonId: seasonFilter,
      };
      void savePlayer(player);
      count++;
    }

    onToast(`Successfully imported ${count} players to roster!`);
    setBulkText("");
    setShowBulkPaste(false);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.teamId) {
      onToast("Player name and team are required.", "error");
      return;
    }

    const id = form.id ?? generateId();
    const rankBadges: RankBadge[] = form.rankBadges
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((label, i) => ({ label, statKey: "custom", rank: i + 1, scope: "team" as const }));

    const player: Player = {
      id,
      personId: form.personId.trim() || id,
      name: form.name.trim(),
      jerseyNumber: parseInt(form.jerseyNumber, 10) || 0,
      position: form.position,
      teamId: form.teamId,
      height: form.height.trim(),
      photoUrl: form.photoUrl.trim() || null,
      seasonAverages: {
        ppg: toNumber(form.ppg),
        rpg: toNumber(form.rpg),
        apg: toNumber(form.apg),
        spg: toNumber(form.spg),
        bpg: toNumber(form.bpg),
        fgPct: toNumber(form.fgPct),
        threePtPct: toNumber(form.threePtPct),
        ftPct: toNumber(form.ftPct),
        ...(isVolleyball
          ? {
              killsPerSet: toNumber(form.killsPerSet),
              digsPerSet: toNumber(form.digsPerSet),
              blocksPerSet: toNumber(form.blocksPerSet),
            }
          : {}),
      },
      rankBadges,
      seasonId: form.seasonId,
    };

    void savePlayer(player);
    onToast(form.id ? "Player updated successfully!" : "Player created successfully!");
    setForm(playerToForm(player));
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete ${name}? This can't be undone.`)) return;
    void deletePlayer(id);
    if (form.id === id) startCreate();
    onToast("Player deleted.");
  }

  function handleDeleteAll() {
    if (!window.confirm("Are you sure you want to delete ALL players? This cannot be undone.")) return;
    void deleteAllPlayers();
    startCreate();
    onToast("All players deleted successfully.");
  }

  const bulkParsedPreview = parseBulkRosterText(bulkText);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-2">
        <div className="flex-1">
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
        </div>
        {allPlayers.length > 0 && (
          <button type="button" onClick={handleDeleteAll} className={dangerButtonClass}>
            Delete All Players
          </button>
        )}
      </div>

      <SectionCard>
        <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/20 text-xs font-bold text-primary">
              ⚡
            </span>
            <p className="text-sm font-bold text-foreground">Quick Roster Builder</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBulkPaste(!showBulkPaste)}
              className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted/20"
            >
              {showBulkPaste ? "Row Mode" : "📋 Paste Bulk Roster"}
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <label className="text-xs font-semibold text-muted">Target Team:</label>
          <select
            value={activeQuickTeamId}
            onChange={(e) => setQuickTeamId(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-bold text-foreground"
          >
            {teamsInListSeason.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.shortName})
              </option>
            ))}
          </select>
        </div>

        {showBulkPaste ? (
          <div className="mt-3 flex flex-col gap-3">
            <Field label="Paste Raw Roster Text (e.g. '#7 Kevin Quiambao F 6-6' or tab/CSV rows)">
              <textarea
                rows={5}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"#7 Kevin Quiambao F 6-6\n#10 JD Cagulangan PG 5-9\n12 Mike Phillips C 6-8"}
                className={`${inputClass} font-mono text-xs`}
              />
            </Field>

            {bulkParsedPreview.length > 0 && (
              <div className="rounded-lg border border-border bg-background p-2 text-xs">
                <p className="font-semibold text-foreground">
                  Detected {bulkParsedPreview.length} player(s):
                </p>
                <ul className="mt-1 max-h-24 overflow-y-auto font-mono text-[11px] text-muted">
                  {bulkParsedPreview.map((p, i) => (
                    <li key={i}>
                      #{p.jerseyNumber} {p.name} ({p.position}) {p.height}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={handleBulkImport}
              className={primaryButtonClass}
            >
              Import {bulkParsedPreview.length} Players
            </button>
          </div>
        ) : (
          <form onSubmit={handleQuickRowAdd} className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="number"
              placeholder="#"
              value={quickJersey}
              onChange={(e) => setQuickJersey(e.target.value)}
              className={`${inputClass} w-14 text-center`}
            />
            <input
              type="text"
              placeholder="Player Full Name"
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              className={`${inputClass} min-w-[140px] flex-1`}
            />
            <select
              value={quickPos}
              onChange={(e) => setQuickPos(e.target.value as Position)}
              className={`${selectClass} w-20`}
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Ht"
              value={quickHeight}
              onChange={(e) => setQuickHeight(e.target.value)}
              className={`${inputClass} w-16 text-center`}
            />
            <button type="submit" className={primaryButtonClass}>
              + Add Row
            </button>
          </form>
        )}
      </SectionCard>

      <SectionCard
        title={form.id ? "Edit Player Attributes" : "Add Player (Full Details)"}
        action={
          form.id ? (
            <button type="button" onClick={startCreate} className={ghostButtonClass}>
              + New Player
            </button>
          ) : undefined
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Season">
            <select
              className={selectClass}
              value={form.seasonId}
              onChange={(e) =>
                setForm({
                  ...form,
                  seasonId: e.target.value,
                  teamId: allTeams.find((t) => t.seasonId === e.target.value)?.id ?? "",
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

          <Field label="Team">
            <select
              className={selectClass}
              value={form.teamId}
              onChange={(event) => setForm({ ...form, teamId: event.target.value })}
            >
              {teamsInFormSeason.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.shortName})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Full Name">
            <input
              className={inputClass}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="e.g. Kevin Quiambao"
            />
          </Field>

          <Field label="Person ID (shared across season rows for lifetime stats)">
            <input
              className={inputClass}
              value={form.personId}
              onChange={(event) => setForm({ ...form, personId: event.target.value })}
              placeholder="e.g. kevin-quiambao"
            />
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Jersey #">
              <input
                className={inputClass}
                type="number"
                value={form.jerseyNumber}
                onChange={(event) => setForm({ ...form, jerseyNumber: event.target.value })}
              />
            </Field>

            <Field label="Position">
              <select
                className={selectClass}
                value={form.position}
                onChange={(event) =>
                  setForm({ ...form, position: event.target.value as Position })
                }
              >
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Height">
              <input
                className={inputClass}
                value={form.height}
                onChange={(event) => setForm({ ...form, height: event.target.value })}
                placeholder='6&apos;7"'
              />
            </Field>
          </div>

          <Field label="Photo URL (optional)">
            <input
              className={inputClass}
              value={form.photoUrl}
              onChange={(event) => setForm({ ...form, photoUrl: event.target.value })}
              placeholder="https://..."
            />
          </Field>

          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-semibold text-foreground">
              Base Season Averages ({isVolleyball ? "Volleyball" : "Basketball"})
            </p>
            {isVolleyball ? (
              <div className="grid grid-cols-3 gap-2">
                <Field label="Kills/Set">
                  <input
                    className={inputClass}
                    type="number"
                    step="0.1"
                    value={form.killsPerSet}
                    onChange={(e) => setForm({ ...form, killsPerSet: e.target.value })}
                  />
                </Field>
                <Field label="Digs/Set">
                  <input
                    className={inputClass}
                    type="number"
                    step="0.1"
                    value={form.digsPerSet}
                    onChange={(e) => setForm({ ...form, digsPerSet: e.target.value })}
                  />
                </Field>
                <Field label="Blocks/Set">
                  <input
                    className={inputClass}
                    type="number"
                    step="0.1"
                    value={form.blocksPerSet}
                    onChange={(e) => setForm({ ...form, blocksPerSet: e.target.value })}
                  />
                </Field>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                <Field label="PPG">
                  <input
                    className={inputClass}
                    type="number"
                    step="0.1"
                    value={form.ppg}
                    onChange={(e) => setForm({ ...form, ppg: e.target.value })}
                  />
                </Field>
                <Field label="RPG">
                  <input
                    className={inputClass}
                    type="number"
                    step="0.1"
                    value={form.rpg}
                    onChange={(e) => setForm({ ...form, rpg: e.target.value })}
                  />
                </Field>
                <Field label="APG">
                  <input
                    className={inputClass}
                    type="number"
                    step="0.1"
                    value={form.apg}
                    onChange={(e) => setForm({ ...form, apg: e.target.value })}
                  />
                </Field>
                <Field label="3P%">
                  <input
                    className={inputClass}
                    type="number"
                    step="0.1"
                    value={form.threePtPct}
                    onChange={(e) => setForm({ ...form, threePtPct: e.target.value })}
                  />
                </Field>
              </div>
            )}
          </div>

          <Field label="Rank Badges (comma-separated labels)">
            <input
              className={inputClass}
              value={form.rankBadges}
              onChange={(event) => setForm({ ...form, rankBadges: event.target.value })}
              placeholder='#1 in PPG, Season MVP'
            />
          </Field>

          <button type="submit" className={primaryButtonClass}>
            {form.id ? "Update Player" : "Create Player"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title={`Players Roster (${filteredPlayers.length})`}>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Search">
              <input
                className={inputClass}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name..."
              />
            </Field>
            <Field label="Filter by team">
              <select
                className={selectClass}
                value={teamFilter}
                onChange={(event) => setTeamFilter(event.target.value)}
              >
                <option value="ALL">All Teams</option>
                {teamsInListSeason.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.shortName}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {filteredPlayers.length === 0 ? (
            <p className="py-4 text-xs text-muted">No players match the search/filter.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredPlayers.map((player) => {
                const team = allTeams.find((t) => t.id === player.teamId);
                return (
                  <div
                    key={player.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">
                        #{player.jerseyNumber} {player.name}
                      </p>
                      <p className="truncate text-[10px] text-muted">
                        {player.position} &middot; {team?.shortName ?? "Unknown"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => startEdit(player)}
                        className={ghostButtonClass}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(player.id, player.name)}
                        className={dangerButtonClass}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
