"use client";

import { logoutAdmin } from "@/app/admin/actions";
import { useSportsData, useSportsScope } from "@/context/SportsDataContext";
import { cn } from "@/lib/utils";

import {
  AlertTriangle,
  Archive,
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  Loader2,
  LogOut,
  Shield,
  ArrowRight,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { GameImporterTab } from "./GameImporterTab";
import { GamesManager } from "./GamesManager";
import { PlayersManager } from "./PlayersManager";
import { ScheduleManagerTab } from "./ScheduleManagerTab";
import { SeasonsManager } from "./SeasonsManager";
import { TeamsManager } from "./TeamsManager";
import { UAAPArchiveManager } from "./UAAPArchiveManager";
import { Toast, type ToastState } from "./Toast";

type AdminTab = "importer" | "schedule" | "games" | "players" | "teams" | "seasons" | "uaap";

const TABS: { value: AdminTab; label: string; icon: ComponentType<{ size?: number }> }[] = [
  { value: "importer", label: "Importer", icon: Sparkles },
  { value: "schedule", label: "Schedule", icon: CalendarDays },
  { value: "games", label: "Games", icon: ClipboardList },
  { value: "players", label: "Players", icon: Users },
  { value: "teams", label: "Teams", icon: Shield },
  { value: "seasons", label: "Seasons", icon: CalendarDays },
  { value: "uaap", label: "UAAP Archive", icon: Archive },
];

const TAB_VALUES = new Set<string>(TABS.map((tab) => tab.value));

const TAB_HELP: Record<AdminTab, { title: string; description: string }> = {
  importer: { title: "Bring the numbers in.", description: "Extract official match reports, review the results, then publish them to your selected season." },
  schedule: { title: "Build the next matchday.", description: "Choose a competition, add fixtures, and review the full schedule before publishing. All times are Philippine time." },
  games: { title: "Keep every score current.", description: "Update live scores, manage match details, and maintain complete box scores." },
  players: { title: "Put the roster together.", description: "Add players one at a time or paste a roster. Choose the season and target team before entering player details." },
  teams: { title: "Make every team at home.", description: "Manage team identities, branding, and records for each competition." },
  seasons: { title: "Set the season in motion.", description: "Create competitions and choose the current season shown to fans in each league." },
  uaap: { title: "Preserve the full story.", description: "Maintain historical standings, awards, and results across the UAAP archive." },
};

export function AdminDashboard() {
  useSportsScope("admin=1");
  const { loading, error, clearError, refreshData, games, players, teams, seasons } = useSportsData();
  const [tab, setTab] = useState<AdminTab>("importer");
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, tone: ToastState["tone"] = "success") => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast({ message, tone });
    toastTimeout.current = setTimeout(() => setToast(null), tone === "error" ? 10000 : 6000);
  }, []);

  useEffect(() => () => { if (toastTimeout.current) clearTimeout(toastTimeout.current); }, []);

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (TAB_VALUES.has(hash)) setTab(hash as AdminTab);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  function selectTab(next: AdminTab) {
    setTab(next);
    const url = `${window.location.pathname}${window.location.search}#${next}`;
    window.history.replaceState(null, "", url);
  }

  async function handleLogout() {
    try {
      await logoutAdmin();
      window.location.assign("/admin");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not sign out. Please try again.", "error");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-4 md:px-7">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">Admin Dashboard</p>
          <p className="flex items-center gap-1.5 truncate text-[11px] text-muted">
            {loading ? (
              <>
                <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                Syncing with database…
              </>
            ) : (
              "Manage fixtures, rosters, and live scores"
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-elevated hover:text-foreground"
          >
            <LogOut size={14} aria-hidden="true" />
            Sign out
          </button>
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-elevated"
          >
            <ChevronLeft size={14} aria-hidden="true" />
            View site
          </Link>
        </div>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 border-b border-live/40 bg-live/10 px-4 py-2.5 text-xs text-foreground"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-live" aria-hidden="true" />
          <p className="flex-1 leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={() => void refreshData()}
            className="shrink-0 rounded-md border border-border px-2 py-1 font-semibold transition-colors hover:bg-elevated"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={clearError}
            aria-label="Dismiss error"
            className="shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-elevated hover:text-foreground"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      <div className="mx-auto grid w-full max-w-[1440px] flex-1 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="min-w-0 border-b border-border bg-surface/30 lg:border-r lg:border-b-0">
        <p className="hidden px-7 pb-3 pt-7 text-[10px] font-bold uppercase tracking-[0.2em] text-muted lg:block">Workspace</p>
      <div
        role="tablist"
        aria-label="Admin sections"
        className="flex gap-1 overflow-x-auto p-3 lg:sticky lg:top-24 lg:flex-col lg:px-4"
      >
        {TABS.map((item) => {
          const Icon = item.icon;
          const selected = tab === item.value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={selected}
              id={`admin-tab-${item.value}`}
              aria-controls={`admin-panel-${item.value}`}
              tabIndex={selected ? 0 : -1}
              onKeyDown={(event) => {
                const index = TABS.findIndex(t => t.value === tab);
                const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1
                  : ["ArrowRight", "ArrowDown"].includes(event.key) ? (index + 1) % TABS.length
                    : ["ArrowLeft", "ArrowUp"].includes(event.key) ? (index + TABS.length - 1) % TABS.length : -1;
                if (nextIndex < 0) return;
                event.preventDefault();
                selectTab(TABS[nextIndex].value);
                document.getElementById(`admin-tab-${TABS[nextIndex].value}`)?.focus();
              }}
              onClick={() => selectTab(item.value)}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors lg:text-left",
                selected ? "bg-primary/10 text-foreground ring-1 ring-primary/30" : "text-muted hover:bg-elevated hover:text-foreground"
              )}
            >
              <Icon size={14} />
              {item.label}
            </button>
          );
        })}
      </div>
      </aside>

      <div className="min-w-0 px-4 py-6 md:px-7">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Manage / {TABS.find(t => t.value === tab)?.label}</p>
            <h1 className="page-heading">{TAB_HELP[tab].title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{TAB_HELP[tab].description}</p>
          </div>
        </div>
        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([{ label: "Seasons", value: seasons.length, target: "seasons" }, { label: "Teams", value: teams.length, target: "teams" }, { label: "Players", value: players.length, target: "players" }, { label: "Matches", value: games.length, target: "games" }] as const).map(item => (
            <button type="button" key={item.label} onClick={() => selectTab(item.target)} className="group flex items-center justify-between rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:border-primary/40">
              <span><span className="block text-lg font-extrabold tabular-nums">{loading ? "–" : item.value.toLocaleString()}</span><span className="text-[11px] text-muted">{item.label}</span></span>
              <ArrowRight size={14} className="text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`} tabIndex={0}>
        {tab === "importer" ? <GameImporterTab onToast={showToast} /> : null}
        {tab === "schedule" ? <ScheduleManagerTab onToast={showToast} /> : null}
        {tab === "games" ? <GamesManager onToast={showToast} /> : null}
        {tab === "players" ? <PlayersManager onToast={showToast} /> : null}
        {tab === "teams" ? <TeamsManager onToast={showToast} /> : null}
        {tab === "seasons" ? <SeasonsManager onToast={showToast} /> : null}
        {tab === "uaap" ? <UAAPArchiveManager onToast={showToast} /> : null}
        </div>
      </div>
      </div>
    </div>
  );
}
