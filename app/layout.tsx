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
import { headers } from "next/headers";
import { fetchSportsData, type SportsDataScope, type SupabaseDataResult } from "@/lib/supabase-data";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { pageMetadata, SITE_DESCRIPTION, SITE_TITLE, SITE_URL, siteJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getLeaguePageData, getPlayerPageData, getTeamPageData } from "@/lib/public-page-data";
import { findLeaguePage } from "@/lib/leagues";

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
  ...pageMetadata(SITE_TITLE, SITE_DESCRIPTION, "/"),
  metadataBase: new URL(SITE_URL),
  applicationName: "Sportsmetric",
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION, other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolve the shell before sending HTML. A streamed fallback around the whole
  // site leaves non-JavaScript visitors looking at a loader instead of content.
  const shell = await SportsShell({ children });
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-bg">
        <a href="#main-content" className="skip-link">Skip to content</a>
        {shell}
      </body>
    </html>
  );
}

async function SportsShell({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-sports-path") ?? "/";
  let scope: SportsDataScope = { league: "UAAP" };
  let query = "league=UAAP";
  let pageData: ReturnType<typeof getPlayerPageData> | undefined;
  if (pathname.startsWith("/players/")) {
    const id = decodeURIComponent(pathname.slice("/players/".length));
    scope = { playerId: id };
    query = `player=${encodeURIComponent(id)}`;
    pageData = getPlayerPageData(id);
  } else if (pathname.startsWith("/teams/")) {
    const id = decodeURIComponent(pathname.slice("/teams/".length));
    scope = { teamId: id };
    query = `team=${encodeURIComponent(id)}`;
    pageData = getTeamPageData(id);
  } else if (pathname.startsWith("/leagues/") && findLeaguePage(pathname.split("/")[2])) {
    const league = findLeaguePage(pathname.split("/")[2])!.league;
    scope = { league };
    query = `league=${league}`;
    pageData = getLeaguePageData(league);
  } else if (pathname === "/admin" && await isAdminAuthenticated()) {
    scope = { admin: true };
    query = "admin=1";
  } else if (pathname === "/admin" || pathname === "/uaap" || pathname === "/news" || pathname.startsWith("/news/")) {
    scope = { metadata: true };
    query = "metadata=1";
  }
  let data: SupabaseDataResult | undefined;
  let loadError: string | undefined;
  try {
    data = await (pageData ?? fetchSportsData(scope));
  } catch (err) {
    console.error("[Sports shell] Initial data load failed:", err);
    loadError = "Sports data is temporarily unavailable. Please try again.";
  }
  if (data && /^league=(UAAP|PBA|PVL)$/.test(query)) {
    const league = query.slice("league=".length);
    const seasonId = data.seasons.find(s => s.league === league && s.isCurrent)?.id ?? data.seasons.find(s => s.league === league)?.id;
    if (seasonId) query += `&season=${encodeURIComponent(seasonId)}`;
  }
  return (
    <SportsDataProvider initialData={data} initialQuery={query} initialError={loadError}>
      <GameModalProvider>
        <div className="flex min-h-screen w-full flex-col">
          <JsonLd data={siteJsonLd} />
          <DesktopTopBar />
          <MobileShell>
            <Header />
            <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">{children}</main>
            {!pathname.startsWith("/admin") && <SiteFooter />}
            <BottomNav />
          </MobileShell>
        </div>
        <GameDetailModal />
      </GameModalProvider>
    </SportsDataProvider>
  );
}
