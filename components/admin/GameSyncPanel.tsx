"use client";

import { useCallback, useEffect, useState } from "react";
import type { SyncSource } from "@/lib/game-sync/types";

type Status = {
  settings: { enabled: boolean; last_started_at: string | null; lease_until: string | null };
  sources: SyncSource[];
  runs: { id: string; status: string; started_at: string; summary: { checked?: number; updated?: number; held?: number } }[];
  issues: { source_id: string; source_key: string; game_id?: string; message: string }[];
  paused: { game_id: string; paused: boolean }[];
};
const when = (value?: string | null) => value ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value)) : "Not checked yet";
const button = "min-h-11 rounded-control border border-border px-4 py-2 text-sm font-semibold hover:border-primary disabled:opacity-50";

export function GameSyncPanel() {
  const [data, setData] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [clock, setClock] = useState(0);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/game-sync", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setData(result); setError("");
      setClock(Date.now());
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load updater."); }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 60000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [load]);
  const act = async (body: Record<string, unknown>) => {
    setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/admin/game-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (body.action === "preview" || body.action === "run") setMessage(result.skipped ? result.reason : (body.action === "preview" ? "Preview only: " : "Check finished: ") + result.checked + " checked, " + result.updated + (body.action === "preview" ? " proposed changes, " : " changes, ") + result.held + " held for review.");
      else setMessage("Settings saved.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not complete updater action."); }
    finally { setBusy(false); }
  };
  const stale = clock > 0 && data?.settings.enabled && (!data.settings.last_started_at || clock - Date.parse(data.settings.last_started_at) > 45 * 60000);
  return <div className="space-y-6">
    {error && <p role="alert" className="rounded-card border border-red-500/40 bg-red-500/10 p-4 text-sm">{error}</p>}
    {message && <p role="status" className="rounded-card border border-primary/30 bg-primary/10 p-4 text-sm">{message}</p>}
    {!data ? <button className={button} onClick={() => void load()}>Reload status</button> : <>
      <section className="space-y-4 rounded-card border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-bold">{data.settings.enabled ? "Automatic updates enabled" : "Automatic updates paused"}</h2><p className="mt-1 text-sm text-muted">Last run: {when(data.settings.last_started_at)} · Philippine time</p></div>
          <button className={button} disabled={busy} onClick={() => void act({ action: "toggle", enabled: !data.settings.enabled })}>{data.settings.enabled ? "Pause all updates" : "Enable updates"}</button></div>
        {stale && <p role="alert" className="text-sm text-amber-500">No run has started in the last 45 minutes. Check the Supabase scheduler; enabling this switch alone does not install it.</p>}
        <div className="flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={() => void act({ action: "preview" })}>{busy ? "Working…" : "Preview changes"}</button><button className={button} disabled={busy || !data.settings.enabled} onClick={() => void act({ action: "run" })}>Check now</button><button className={button} disabled={busy} onClick={() => void load()}>Refresh status</button></div>
      </section>
      <section className="space-y-3"><h2 className="text-lg font-bold">Competitions</h2>{data.sources.map(source => <article key={source.id} className="rounded-card border border-border bg-surface p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{source.label}</h3><p className="mt-1 text-sm text-muted">Last successful source check: {when(source.last_success_at)}</p><p className="mt-1 text-xs text-muted">{source.league === "UAAP" ? "LiveStats results; upcoming fixtures appear when published by this source." : "Upcoming schedule and official final results."}</p></div><button className={button} disabled={busy} onClick={() => void act({ action: "source", id: source.id, enabled: !source.enabled })}>{source.enabled ? "Pause" : "Resume"}</button></div>{source.last_error && <p className="mt-3 text-sm text-amber-500">{source.last_error}</p>}</article>)}</section>
      <section className="space-y-3"><h2 className="text-lg font-bold">Needs review ({data.issues.length})</h2>{!data.issues.length && <p className="text-sm text-muted">No unresolved exceptions.</p>}{data.issues.map(issue => <article key={issue.source_id + issue.source_key} className="rounded-card border border-border p-4"><p className="text-xs text-muted">{data.sources.find(s => s.id === issue.source_id)?.label ?? issue.source_id}</p><p className="mt-1 text-sm">{issue.message}</p>{issue.game_id && <div className="mt-2 flex flex-wrap items-center gap-3"><span className="break-all text-xs text-muted">{issue.game_id}</span><button className={button} disabled={busy} onClick={() => void act({ action: "game", id: issue.game_id, paused: true })}>Keep manual control</button></div>}</article>)}</section>
      {!!data.paused.length && <section className="space-y-3"><h2 className="text-lg font-bold">Games under manual control</h2>{[...new Set(data.paused.map(p => p.game_id))].map(id => <div key={id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border p-4"><span className="break-all text-sm">{id}</span><button className={button} disabled={busy} onClick={() => void act({ action: "game", id, paused: false })}>Resume automatic updates</button></div>)}</section>}
      <section className="space-y-3"><h2 className="text-lg font-bold">Recent checks</h2>{data.runs.map(run => <div key={run.id} className="flex flex-wrap justify-between gap-2 border-b border-border py-3 text-sm"><span>{when(run.started_at)}</span><span>{run.status} · {run.summary.updated ?? 0} changes · {run.summary.held ?? 0} held</span></div>)}</section>
    </>}
  </div>;
}
