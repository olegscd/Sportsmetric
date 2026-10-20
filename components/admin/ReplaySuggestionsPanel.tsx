"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useSportsData } from "@/context/SportsDataContext";
import type { League, ReplayKind } from "@/types/sports";
import { REPLAY_KIND_LABELS } from "@/lib/watch-links";
import type { ReplayChannel } from "@/lib/replay-sync/match";
import type { ToastFn } from "./Toast";
import { Field, ghostButtonClass, inputClass, primaryButtonClass, SectionCard, selectClass } from "./formPrimitives";

type Suggestion = {
  id: string; game_id: string; video_id: string; video_url: string; title: string; channel_title: string;
  published_at: string; duration_seconds: number; kind: ReplayKind; inferred_kind_reason: string; score: number;
  match_reasons: string[]; games: { league: League; season_id: string; home_team_id: string; away_team_id: string; start_time: string };
};
type Dashboard = {
  settings: { enabled: boolean; schedule_configured: boolean; last_started_at: string | null; last_dead_check_at: string | null; lease_until: string | null };
  channels: ReplayChannel[]; pending: Suggestion[];
  runs: { id: string; status: string; started_at: string; units_used: number; candidates: number; suggestions_created: number; errors: string[]; summary: { continuation?: boolean } }[];
  issues: { id: string; game_id: string | null; code: string; message: string; video_id: string | null }[];
  quota: { day: string; units_used: number }[]; apiKeyConfigured: boolean;
};
const date = (v: string) => new Date(v).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });

export function ReplaySuggestionsPanel({ seasonId, onToast }: { seasonId: string; onToast: ToastFn }) {
  const { teams, seasons, refreshData } = useSportsData();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState({ league: "PVL" as League, channelId: "", label: "", leagueSpecific: false });
  const season = seasons.find(s => s.id === seasonId);
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/admin/replay-sync?${new URLSearchParams({ season: seasonId })}`, { cache: "no-store", signal });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Could not load replay suggestions.");
    return result as Dashboard;
  }, [seasonId]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).then(result => { setData(result); setError(""); }).catch(err => {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not load replay suggestions.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load]);

  async function action(body: Record<string, unknown>, message: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/replay-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save replay changes.");
      setData(await load()); setError("");
      if (body.action === "review" && body.approve) await refreshData();
      onToast(result.skipped ? result.reason : body.action === "scan" || body.action === "backfill"
        ? `Scan finished: ${result.candidates} games checked, ${result.suggestions_created} suggestions. ${result.continuation ? "More uploads remain; scan again to continue." : ""}${result.errors?.length ? " Check the run history for issues." : ""}` : message);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Replay action failed.", "error");
      await load().then(setData).catch(() => {});
    } finally { setBusy(false); }
  }
  const teamName = (id: string) => teams.find(t => t.id === id)?.shortName ?? id;

  return <SectionCard title="Replay suggestions">
    <p className="text-xs leading-relaxed text-muted">Official videos are found automatically. Review each suggestion, then approve it to show the replay on the game. Manual replay links keep working.</p>
    <div aria-live="polite">
      {loading ? <p className="text-xs text-muted">Loading replay suggestions…</p> : error ? <p role="alert" className="text-xs text-negative">{error}</p> : null}
    </div>
    {!loading && !error && data && <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold">Daily scans: {!data.settings.schedule_configured ? "Schedule not installed" : data.settings.enabled ? "On · 4:10 AM PHT" : "Paused"}</span>
        <button type="button" disabled={busy || !data.settings.schedule_configured} className={ghostButtonClass} onClick={() => void action({ action: "toggle", enabled: !data.settings.enabled }, "Daily discovery updated.")}>{data.settings.enabled ? "Pause daily scans" : "Enable daily scans"}</button>
        <button type="button" disabled={busy} className={ghostButtonClass} onClick={() => { setLoading(true); void load().then(result => { setData(result); setError(""); }).catch(err => setError(err.message)).finally(() => setLoading(false)); }}>Refresh suggestions</button>
      </div>
      {!data.apiKeyConfigured && <p role="alert" className="text-xs text-negative">One-time setup needed: add YOUTUBE_API_KEY to the app host and redeploy. The key stays private on the server.</p>}
      {!data.settings.schedule_configured && <p className="text-xs text-muted">To install the daily schedule, run enable_replay_sync.sql in Supabase SQL Editor. You can test manual scans first.</p>}
      {!data.channels.some(c => c.enabled) && <p className="text-xs text-muted">Add a verified official channel below before your first scan. Start with PVL or PBA.</p>}
      <div className="flex flex-col gap-2 rounded-control border border-border p-3">
        <p className="text-xs">Selected season: <strong>{season?.league} · {season?.label}</strong>. Suggestions below belong to this season.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primaryButtonClass} disabled={busy || !data.apiKeyConfigured || !season} onClick={() => void action({ action: "scan", league: season?.league }, "Scan complete.")}>{busy ? "Working…" : `Find recent ${season?.league ?? "game"} replays`}</button>
          <button type="button" className={ghostButtonClass} disabled={busy || !data.apiKeyConfigured || !season} onClick={() => void action({ action: "backfill", seasonId, league: season?.league }, "Season scan complete.")}>Scan older games in this season</button>
        </div>
        <p className="text-2xs text-muted">Recent scans check finals from 6 hours to 21 days ago. Older-season scans continue where the last scan stopped. Neither publishes videos. Manual scans also work while daily scans are paused.</p>
      </div>
      <details className="rounded-control border border-border p-3">
        <summary className="cursor-pointer text-xs font-semibold">Official channels · {data.channels.length} configured</summary>
        <p className="my-3 text-xs text-muted">Copy the official channel&apos;s UC… ID from YouTube. Add a shared broadcaster separately for each league it covers. Leave “Only covers this league” unchecked for One Sports or other shared channels.</p>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void action({ action: "channel", ...channel, enabled: true }, "Official channel saved."); }}>
          <Field label="Channel league"><select className={selectClass} value={channel.league} onChange={e => setChannel(c => ({ ...c, league: e.target.value as League }))}>{["PVL", "PBA", "UAAP"].map(l => <option key={l}>{l}</option>)}</select></Field>
          <Field label="Channel label"><input className={inputClass} required maxLength={60} value={channel.label} onChange={e => setChannel(c => ({ ...c, label: e.target.value }))} placeholder="e.g. One Sports" /></Field>
          <Field label="Official YouTube channel ID"><input className={inputClass} required pattern="UC[A-Za-z0-9_-]{22}" value={channel.channelId} onChange={e => setChannel(c => ({ ...c, channelId: e.target.value.trim() }))} placeholder="UC… (24 characters)" /></Field>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={channel.leagueSpecific} onChange={e => setChannel(c => ({ ...c, leagueSpecific: e.target.checked }))} />Only covers this league</label>
          <button className={primaryButtonClass} disabled={busy} type="submit">Save official channel</button>
        </form>
        <ul className="mt-3 space-y-2">{data.channels.map(c => <li key={`${c.league}:${c.channel_id}`} className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <a className="text-primary underline" href={`https://www.youtube.com/channel/${c.channel_id}`} target="_blank" rel="noopener noreferrer">{c.league} · {c.label}{c.league_specific ? " · League-specific" : " · Shared broadcaster"}</a>
          <button type="button" className={ghostButtonClass} disabled={busy} onClick={() => void action({ action: "channel", league: c.league, channelId: c.channel_id, label: c.label, leagueSpecific: c.league_specific, enabled: !c.enabled }, "Channel updated.")}>{c.enabled ? "Disable" : "Enable"}</button>
        </li>)}</ul>
      </details>
      <p className="text-xs font-semibold">Pending review · {data.pending.length}{data.pending.length === 100 ? " (first 100; refresh after reviewing)" : ""}</p>
      {!data.pending.length && <p className="text-xs text-muted">No pending suggestions for this season. Run a scan or choose another season above.</p>}
      {data.pending.map(r => <article key={r.id} className="flex flex-col gap-3 rounded-control border border-border p-3 sm:flex-row">
        <a className="shrink-0" href={r.video_url} target="_blank" rel="noopener noreferrer" aria-label={`Watch suggestion: ${r.title}`}>
          <Image src={`https://i.ytimg.com/vi/${r.video_id}/hqdefault.jpg`} width={160} height={120} unoptimized alt="" className="rounded-control" />
        </a>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-xs font-bold">{r.games.league} · {teamName(r.games.away_team_id)} at {teamName(r.games.home_team_id)} · {date(r.games.start_time)} PHT</p>
          <a href={r.video_url} target="_blank" rel="noopener noreferrer" className="break-words text-sm font-semibold text-primary underline">{r.title}</a>
          <p className="text-xs text-muted">{r.channel_title} · {date(r.published_at)} PHT · {Math.floor(r.duration_seconds / 60)}m {r.duration_seconds % 60}s</p>
          <p className="text-xs">{REPLAY_KIND_LABELS[r.kind]} · Match {Math.round(r.score * 100)}%</p>
          <details className="text-xs text-muted"><summary className="cursor-pointer">Why this matched</summary><ul className="mt-1 list-inside list-disc">{r.match_reasons.map(reason => <li key={reason}>{reason}</li>)}<li>{r.inferred_kind_reason}</li></ul></details>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} className={primaryButtonClass} onClick={() => void action({ action: "review", id: r.id, approve: true }, "Replay approved and published on the game.")}>Approve replay</button>
            <button type="button" disabled={busy} className={ghostButtonClass} onClick={() => void action({ action: "review", id: r.id, approve: false }, "Suggestion rejected. This video will not be suggested for this game again.")}>Reject</button>
          </div>
        </div>
      </article>)}
      <details className="rounded-control border border-border p-3" open={data.issues.length > 0}>
        <summary className="cursor-pointer text-xs font-semibold">Issues to check · {data.issues.length}</summary>
        {data.issues.map(i => <div key={i.id} className="mt-3 flex flex-col gap-2 text-xs">
          <p>{i.game_id ? `${i.game_id}: ` : ""}{i.message}</p>
          <div className="flex flex-wrap gap-2">{i.video_id && <a className="text-primary underline" href={`https://www.youtube.com/watch?v=${i.video_id}`} target="_blank" rel="noopener noreferrer">Check video</a>}
            <button type="button" disabled={busy} className={ghostButtonClass} onClick={() => void action({ action: "resolve", id: i.id }, "Issue marked checked.")}>Mark checked</button></div>
        </div>)}
      </details>
      <details className="rounded-control border border-border p-3">
        <summary className="cursor-pointer text-xs font-semibold">Run history and quota</summary>
        <p className="mt-2 text-2xs text-muted">App budget: 3,000 API units per Pacific day, shared by scheduled and manual runs. {data.quota[0] ? `${data.quota[0].day}: ${data.quota[0].units_used} units used.` : "No API usage yet."} Last link check: {data.settings.last_dead_check_at ? `${date(data.settings.last_dead_check_at)} PHT` : "Not yet completed"}.</p>
        {data.runs.map(r => <div key={r.id} className="mt-3 text-xs"><p>{date(r.started_at)} PHT · {r.status} · {r.candidates} games · {r.suggestions_created} suggestions · {r.units_used} units</p>
          {r.summary.continuation && <p className="text-muted">More uploads or links remain. Scan again to continue.</p>}
          {r.errors.map((err, i) => <p key={i} className="text-negative">{err}</p>)}
        </div>)}
      </details>
    </>}
  </SectionCard>;
}
