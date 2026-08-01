"use client";

import { resetAllDataToDefaults } from "@/lib/data";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { BoxScoreParserTab } from "./BoxScoreParserTab";
import { GamesManager } from "./GamesManager";
import { PlayersManager } from "./PlayersManager";
import { SeasonsManager } from "./SeasonsManager";
import { TeamsManager } from "./TeamsManager";
import { Toast, type ToastState } from "./Toast";

type AdminTab = "seasons" | "players" | "teams" | "games" | "parser";

const TABS: { value: AdminTab; label: string; emoji: string }[] = [
  { value: "seasons", label: "Seasons", emoji: "\u{1F4C6}" },
  { value: "players", label: "Players", emoji: "\u{1F465}" },
  { value: "teams", label: "Teams", emoji: "\u{1F6E1}\uFE0F" },
  { value: "games", label: "Games", emoji: "\u{1F3C0}" },
  { value: "parser", label: "Parser", emoji: "\u26A1" },
];

export function AdminDashboard() {
  const [tab, setTab] = useState<AdminTab>("players");
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, tone: ToastState["tone"] = "success") => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast({ message, tone });
    toastTimeout.current = setTimeout(() => setToast(null), 2800);
  }, []);

  function handleReset() {
    const confirmed = window.confirm(
      "Reset all Sportsmetric data to the original mock data? Every admin edit will be lost -- this can't be undone."
    );
    if (!confirmed) return;
    resetAllDataToDefaults();
    showToast("Reset to original mock data.");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <Toast toast={toast} />

      <div className="sticky top-14 z-20 flex items-center justify-between gap-3 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">Admin Dashboard</p>
          <p className="truncate text-[11px] text-muted">
            Manage players, teams &amp; live scores
          </p>
        </div>
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground active:bg-elevated"
        >
          <ChevronLeft size={14} />
          Back to App
        </Link>
      </div>

      <div className="flex gap-1 border-b border-border px-3 pt-3">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-t-xl px-2 pb-2.5 pt-1.5 text-[11px] font-semibold transition-colors",
              tab === t.value ? "bg-surface text-foreground" : "text-muted"
            )}
          >
            <span className="text-base leading-none">{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 py-4">
        {tab === "seasons" ? <SeasonsManager onToast={showToast} /> : null}
        {tab === "players" ? <PlayersManager onToast={showToast} /> : null}
        {tab === "teams" ? <TeamsManager onToast={showToast} /> : null}
        {tab === "games" ? <GamesManager onToast={showToast} /> : null}
        {tab === "parser" ? <BoxScoreParserTab onToast={showToast} /> : null}
      </div>

      <div className="border-t border-border px-4 py-4">
        <button
          type="button"
          onClick={handleReset}
          className="w-full rounded-xl border border-live/30 bg-live/10 py-2.5 text-xs font-bold text-live active:bg-live/20"
        >
          Reset to Original Mock Data
        </button>
      </div>
    </div>
  );
}
