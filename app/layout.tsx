import { GameDetailModal } from "@/components/game-detail/GameDetailModal";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { MobileShell } from "@/components/layout/MobileShell";
import { DesktopTopBar } from "@/components/layout/DesktopTopBar";
import { SportsDataProvider } from "@/context/SportsDataContext";
import { GameModalProvider } from "@/lib/game-modal-context";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { headers } from "next/headers";
import { fetchSportsData, type SportsDataScope, type SupabaseDataResult } from "@/lib/supabase-data";
import { isAdminAuthenticated } from "@/lib/admin-auth";

// Every HTML response must be rendered with the request's CSP nonce.
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sportsmetric",
  description:
    "Live scores, athlete digital resumes, and shareable stat cards for UAAP, PBA, and PVL.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-bg">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <Suspense fallback={<p className="p-6" role="status">Loading Sportsmetric…</p>}>
          <SportsShell>{children}</SportsShell>
        </Suspense>
      </body>
    </html>
  );
}

async function SportsShell({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-sports-path") ?? "/";
  let scope: SportsDataScope = { league: "UAAP" };
  let query = "league=UAAP";
  if (pathname.startsWith("/players/")) {
    const id = decodeURIComponent(pathname.slice("/players/".length));
    scope = { playerId: id };
    query = `player=${encodeURIComponent(id)}`;
  } else if (pathname.startsWith("/teams/")) {
    const id = decodeURIComponent(pathname.slice("/teams/".length));
    scope = { teamId: id };
    query = `team=${encodeURIComponent(id)}`;
  } else if (pathname === "/admin" && await isAdminAuthenticated()) {
    scope = { admin: true };
    query = "admin=1";
  } else if (pathname === "/admin" || pathname === "/uaap") {
    scope = { metadata: true };
    query = "metadata=1";
  }
  let data: SupabaseDataResult | undefined;
  let loadError: string | undefined;
  try {
    data = await fetchSportsData(scope);
  } catch (err) {
    console.error("[Sports shell] Initial data load failed:", err);
    loadError = "Sports data is temporarily unavailable. Please try again.";
  }
  if (data && query === "league=UAAP") {
    const seasonId = data.seasons.find(s => s.league === "UAAP" && s.isCurrent)?.id ?? data.seasons.find(s => s.league === "UAAP")?.id;
    if (seasonId) query += `&season=${encodeURIComponent(seasonId)}`;
  }
  return (
    <SportsDataProvider initialData={data} initialQuery={query} initialError={loadError}>
      <GameModalProvider>
        <div className="flex min-h-screen w-full flex-col">
          <DesktopTopBar />
          <MobileShell>
            <Header />
            <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">{children}</main>
            <BottomNav />
          </MobileShell>
        </div>
        <GameDetailModal />
      </GameModalProvider>
    </SportsDataProvider>
  );
}
