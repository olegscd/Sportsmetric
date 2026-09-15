"use client";

import { logoutAdmin } from "@/app/admin/actions";
import { useSportsData } from "@/context/SportsDataContext";
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

export function AdminDashboard() {
  const { loading, error, clearError, refreshData } = useSportsData();
  const [tab, setTab] = useState<AdminTab>("importer");
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, tone: ToastState["tone"] = "success") => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast({ message, tone });
    toastTimeout.current = setTimeout(() => setToast(null), 2800);
  }, []);

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
    await logoutAdmin();
    window.location.assign("/admin");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <Toast toast={toast} />

      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
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
            Back to App
          </Link>
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

      <div
        role="tablist"
        aria-label="Admin sections"
        className="flex gap-1 overflow-x-auto border-b border-border px-3 pt-3"
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
              onClick={() => selectTab(item.value)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-t-xl px-3 pb-2.5 pt-1.5 text-[11px] font-semibold transition-colors",
                selected ? "bg-surface text-foreground" : "text-muted hover:text-foreground"
              )}
            >
              <Icon size={14} />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 px-4 py-4">
        {tab === "importer" ? <GameImporterTab onToast={showToast} /> : null}
        {tab === "schedule" ? <ScheduleManagerTab onToast={showToast} /> : null}
        {tab === "games" ? <GamesManager onToast={showToast} /> : null}
        {tab === "players" ? <PlayersManager onToast={showToast} /> : null}
        {tab === "teams" ? <TeamsManager onToast={showToast} /> : null}
        {tab === "seasons" ? <SeasonsManager onToast={showToast} /> : null}
        {tab === "uaap" ? <UAAPArchiveManager onToast={showToast} /> : null}
      </div>
    </div>
  );
}
