"use client";

import type { ToastFn } from "@/components/admin/Toast";
import { Field, Input, Select } from "@/components/ui/Field";
import { useSportsData } from "@/context/SportsDataContext";
import { adminMutate } from "@/lib/admin-api";
import { REPLAY_KINDS, REPLAY_KIND_LABELS } from "@/lib/watch-links";
import type { Game, GameLinks, ReplayKind, Season, SeasonLinks } from "@/types/sports";
import { useState, type FormEvent } from "react";
import { primaryButtonClass, SectionCard } from "./formPrimitives";

const blank = (v: string) => (v.trim() ? v.trim() : null);

function useSave(onToast: ToastFn) {
  const { refreshData } = useSportsData();
  const [saving, setSaving] = useState(false);
  async function save(run: () => Promise<void>, message: string) {
    setSaving(true);
    try {
      await run();
      await refreshData();
      onToast(message);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Could not save links.", "error");
    } finally {
      setSaving(false);
    }
  }
  return { saving, save };
}

/** Season defaults: the official broadcaster and ticketing partner. */
export function SeasonLinksCard({ seasons, onToast }: { seasons: Season[]; onToast: ToastFn }) {
  const [seasonId, setSeasonId] = useState("");
  const season = seasons.find(s => s.id === seasonId);
  return <SectionCard title="Where to watch & tickets">
    <p className="text-2xs leading-relaxed text-muted">Season defaults for upcoming games: tickets and where to watch. Live games use the livestream saved on that game; finals use its replay. Only use official broadcasters and ticket sellers.</p>
    <Field label="Season">
      <Select value={seasonId} onChange={e => setSeasonId(e.target.value)}>
        <option value="">Choose a season…</option>
        {seasons.map(s => <option key={s.id} value={s.id}>{s.league} · {s.label}{s.links ? " ✓" : ""}</option>)}
      </Select>
    </Field>
    {season && <SeasonLinksForm key={season.id} season={season} onToast={onToast} />}
  </SectionCard>;
}

function SeasonLinksForm({ season, onToast }: { season: Season; onToast: ToastFn }) {
  const l = season.links;
  const [form, setForm] = useState({ watchUrl: l?.watchUrl ?? "", watchLabel: l?.watchLabel ?? "", watchNote: l?.watchNote ?? "",
    ticketsUrl: l?.ticketsUrl ?? "", ticketsLabel: l?.ticketsLabel ?? "" });
  const { saving, save } = useSave(onToast);
  const on = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [key]: e.target.value }));
  function submit(event: FormEvent) {
    event.preventDefault();
    const links: SeasonLinks = { watchUrl: blank(form.watchUrl), watchLabel: blank(form.watchLabel), watchNote: blank(form.watchNote),
      ticketsUrl: blank(form.ticketsUrl), ticketsLabel: blank(form.ticketsLabel) };
    void save(() => adminMutate({ op: "season.links", id: season.id, links }), `Links saved for ${season.label}.`);
  }
  return <form onSubmit={submit} className="flex flex-col gap-3">
    <Field label="Watch link" hint="Official broadcaster or streaming page"><Input type="url" value={form.watchUrl} onChange={on("watchUrl")} placeholder="https://" /></Field>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Broadcaster"><Input value={form.watchLabel} onChange={on("watchLabel")} placeholder="e.g. Cignal Play" /></Field>
      <Field label="Note" hint="e.g. Free in PH, Subscription"><Input value={form.watchNote} onChange={on("watchNote")} /></Field>
    </div>
    <Field label="Tickets link"><Input type="url" value={form.ticketsUrl} onChange={on("ticketsUrl")} placeholder="https://" /></Field>
    <Field label="Ticket seller"><Input value={form.ticketsLabel} onChange={on("ticketsLabel")} placeholder="e.g. TicketNet" /></Field>
    <button type="submit" disabled={saving} className={primaryButtonClass}>{saving ? "Saving…" : "Save season links"}</button>
  </form>;
}

/** Per-game overrides and the replay link for finished games. */
export function GameLinksCard({ game, onToast }: { game: Game; onToast: ToastFn }) {
  const l = game.links;
  const [form, setForm] = useState({ watchUrl: l?.watchUrl ?? "", ticketsUrl: l?.ticketsUrl ?? "", replayUrl: l?.replayUrl ?? "",
    replayKind: (l?.replayKind ?? "highlights") as ReplayKind, replayLabel: l?.replayLabel ?? "" });
  const { saving, save } = useSave(onToast);
  const on = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [key]: e.target.value }));
  function submit(event: FormEvent) {
    event.preventDefault();
    const links: GameLinks = { watchUrl: blank(form.watchUrl), ticketsUrl: blank(form.ticketsUrl), replayUrl: blank(form.replayUrl),
      replayKind: blank(form.replayUrl) ? form.replayKind : null, replayLabel: blank(form.replayUrl) ? blank(form.replayLabel) : null };
    void save(() => adminMutate({ op: "game.links", id: game.id, links }), "Game links saved.");
  }
  return <SectionCard title={`Watch, tickets & replay (${game.awayTeam.shortName} @ ${game.homeTeam.shortName})`}>
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-2xs leading-relaxed text-muted">Paste links for this specific game here, including older games. Upcoming games can use season defaults. Live games show only this game&apos;s livestream; finals show only its replay. If the relevant link is blank, no link appears. Use the official channel&apos;s upload only.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Game livestream link" hint="Direct link to this game's stream; required to show a link when live"><Input type="url" value={form.watchUrl} onChange={on("watchUrl")} placeholder="https://" /></Field>
        <Field label="Tickets link override"><Input type="url" value={form.ticketsUrl} onChange={on("ticketsUrl")} placeholder="https://" /></Field>
      </div>
      <Field label="Replay link" hint="e.g. the official YouTube upload"><Input type="url" value={form.replayUrl} onChange={on("replayUrl")} placeholder="https://" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Replay type"><Select value={form.replayKind} onChange={on("replayKind")} disabled={!form.replayUrl.trim()}>
          {REPLAY_KINDS.map(k => <option key={k} value={k}>{REPLAY_KIND_LABELS[k]}</option>)}</Select></Field>
        <Field label="Channel"><Input value={form.replayLabel} onChange={on("replayLabel")} disabled={!form.replayUrl.trim()} placeholder="e.g. One Sports" /></Field>
      </div>
      <button type="submit" disabled={saving} className={primaryButtonClass}>{saving ? "Saving…" : "Save game links"}</button>
    </form>
  </SectionCard>;
}
