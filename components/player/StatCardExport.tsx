"use client";

import { LeagueBadge } from "@/components/match-center/LeagueBadge";
import { formatAvg, formatPct } from "@/lib/utils";
import type { Player, Team } from "@/types/sports";
import { Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function isVolleyballPlayer(player: Player): boolean {
  return (
    player.seasonAverages.killsPerSet !== undefined ||
    player.position === "OH" ||
    player.position === "MB" ||
    player.position === "S" ||
    player.position === "L" ||
    player.position === "OP"
  );
}

function exportStatTiles(player: Player): { label: string; value: string }[] {
  const { seasonAverages: avg } = player;
  const pos = (player.position || "OH").toUpperCase();

  if (isVolleyballPlayer(player)) {
    if (pos.startsWith("L")) {
      return [
        { label: "Digs / Set", value: formatAvg(avg.avgDig ?? avg.digsPerSet ?? 0) },
        { label: "Dig Success", value: formatPct(avg.successDig ?? 0) },
        { label: "Rec Success", value: formatPct(avg.successRec ?? 0) },
      ];
    }
    if (pos.startsWith("S")) {
      return [
        { label: "Sets / Set", value: formatAvg(avg.avgSet ?? 0) },
        { label: "Setting %", value: formatPct(avg.successSet ?? 0) },
        { label: "Digs / Set", value: formatAvg(avg.avgDig ?? 0) },
      ];
    }
    if (pos.startsWith("MB")) {
      return [
        { label: "PTS / Set", value: formatAvg(avg.avgPerSet ?? avg.ppg ?? 0) },
        { label: "Blocks / Set", value: formatAvg(avg.avgBlk ?? avg.blocksPerSet ?? 0) },
        { label: "Atk Efficiency", value: formatPct(avg.efficiencyAtk ?? avg.attackPct ?? 0) },
      ];
    }
    return [
      { label: "PTS / Set", value: formatAvg(avg.avgPerSet ?? avg.ppg ?? 0) },
      { label: "Kills / Set", value: formatAvg(avg.avgAtk ?? avg.killsPerSet ?? 0) },
      { label: "Atk Efficiency", value: formatPct(avg.efficiencyAtk ?? avg.attackPct ?? 0) },
    ];
  }

  return [
    { label: "PPG", value: formatAvg(avg.ppg) },
    { label: "RPG", value: formatAvg(avg.rpg) },
    { label: "APG", value: formatAvg(avg.apg) },
    { label: "3P%", value: formatPct(avg.threePtPct) },
  ];
}

type ExportStatus = "idle" | "exporting" | "error";

/** IG Story ratio, in CSS px. */
const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;

/**
 * Renders a hidden 1080x1920 (IG Story ratio) DOM node and captures it with
 * html-to-image on demand. Kept as its own isolated client boundary since
 * DOM-to-image capture is the riskiest piece of this app for browser quirks
 * -- if it needs iteration, it can't destabilize the rest of the profile page.
 */
export function StatCardExport({ player, team }: { player: Player; team: Team }) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  // Pre-convert the photo into a same-origin data: URI so the capture step
  // never has to embed a live external image. Admin-supplied photo hosts are
  // arbitrary and most don't send CORS headers, which would otherwise taint
  // the export canvas and produce a broken/unviewable image. If the fetch
  // fails for any reason, we just fall back to the team-color placeholder
  // below instead of breaking the whole export.
  useEffect(() => {
    const photoUrl = player.photoUrl;
    if (!photoUrl) return;
    let cancelled = false;

    fetch(photoUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Photo fetch failed: ${res.status}`);
        return res.blob();
      })
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          })
      )
      .then((dataUrl) => {
        if (!cancelled) setPhotoDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setPhotoDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [player.photoUrl]);

  const handleExport = async () => {
    if (!captureRef.current || status === "exporting") return;
    setStatus("exporting");

    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(captureRef.current, {
        pixelRatio: 1,
        cacheBust: true,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        // Neutralize any inherited offset/transform on the clone so the card
        // is always rasterized at the origin of the <foreignObject> viewport.
        style: {
          position: "static",
          top: "0",
          left: "0",
          margin: "0",
          transform: "none",
        },
      });

      const filename = `${player.name.toLowerCase().replace(/\s+/g, "-")}-sportsmetric-card.png`;

      const nav = typeof navigator !== "undefined" ? navigator : null;
      if (nav?.canShare) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], filename, { type: "image/png" });
        if (nav.canShare({ files: [file] })) {
          await nav.share({ files: [file], title: `${player.name} \u2014 Sportsmetric` });
          setStatus("idle");
          return;
        }
      }

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = filename;
      link.click();
      setStatus("idle");
    } catch (err) {
      console.error("Failed to export stat card", err);
      setStatus("error");
    }
  };

  const tiles = exportStatTiles(player);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleExport}
        disabled={status === "exporting"}
        className="flex items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        <Share2 size={16} />
        {status === "exporting" ? "Preparing image\u2026" : "Share Stat Card"}
      </button>
      {status === "error" ? (
        <p className="text-center text-xs text-live">
          Couldn&apos;t export the stat card. Please try again.
        </p>
      ) : null}

      {/*
        Off-screen (not display:none, which would break capture), full-res
        1080x1920 render target -- never visible to real users.

        The off-screen offset MUST live on this wrapper rather than on the
        captured node: html-to-image copies the captured node's computed
        styles onto its clone, so a `fixed`/negative-offset target would be
        pushed outside the <foreignObject> viewport and rasterize as blank.
      */}
      <div aria-hidden="true" className="pointer-events-none fixed top-0 left-[-10000px]">
        <div
          ref={captureRef}
          className="flex h-[1920px] w-[1080px] flex-col justify-between bg-bg p-20"
        >
          <div className="flex items-center gap-8">
            {photoDataUrl ? (
              // Rendered from a pre-fetched data: URI (see the effect above),
              // never the raw external URL -- keeps the export canvas untainted
              // regardless of the photo host's CORS support.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoDataUrl}
                alt={player.name}
                className="h-40 w-40 shrink-0 rounded-full border-8 object-cover"
                style={{ borderColor: team.accentColor }}
              />
            ) : (
              <div
                className="flex h-40 w-40 shrink-0 items-center justify-center rounded-full border-8 text-5xl font-bold"
                style={{ borderColor: team.accentColor, color: team.accentColor }}
              >
                {team.shortName}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <p className="text-4xl font-semibold text-foreground/70">{team.name}</p>
              <LeagueBadge league={team.league} />
            </div>
          </div>

          <div className="flex flex-col gap-12">
            <div className="flex flex-col gap-4">
              <p className="text-3xl font-semibold uppercase tracking-[0.2em] text-foreground/50">
                #{player.jerseyNumber} &middot; {player.position}
              </p>
              <p className="text-8xl leading-tight font-black text-foreground">{player.name}</p>
            </div>

            {player.rankBadges.length > 0 ? (
              <div className="flex flex-wrap gap-4">
                {player.rankBadges.map((badge) => (
                  <span
                    key={badge.label}
                    className="rounded-full border-2 border-primary bg-primary/10 px-6 py-3 text-2xl font-bold text-primary"
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            ) : null}

            <div className={`grid gap-6 ${tiles.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {tiles.map((tile) => (
                <div
                  key={tile.label}
                  className="flex flex-col items-center gap-2 rounded-3xl border border-border bg-surface py-8"
                >
                  <span className="text-6xl font-bold tabular-nums text-foreground">
                    {tile.value}
                  </span>
                  <span className="text-xl font-medium tracking-wide text-foreground/50 uppercase">
                    {tile.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-10">
            <p className="text-4xl font-bold text-foreground">Sportsmetric</p>
            <p className="text-2xl text-foreground/50">sportsmetric.ph</p>
          </div>
        </div>
      </div>
    </div>
  );
}
