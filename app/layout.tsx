import { GameDetailModal } from "@/components/game-detail/GameDetailModal";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { MobileShell } from "@/components/layout/MobileShell";
import { SportsDataProvider } from "@/context/SportsDataContext";
import { GameModalProvider } from "@/lib/game-modal-context";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
        <SportsDataProvider>
          <GameModalProvider>
            <MobileShell>
              <Header />
              <main className="flex-1">{children}</main>
              <BottomNav />
            </MobileShell>
            <GameDetailModal />
          </GameModalProvider>
        </SportsDataProvider>
      </body>
    </html>
  );
}
