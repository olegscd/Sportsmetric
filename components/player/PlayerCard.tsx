"use client";

import { LeagueBadge } from "@/components/match-center/LeagueBadge";
import { Badge } from "@/components/ui/Badge";
import { cardClasses } from "@/components/ui/Card";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { StatTile } from "@/components/ui/StatTile";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { useSportsData } from "@/context/SportsDataContext";
import { formatAvg, formatPct } from "@/lib/utils";
import type { Player, SeasonAverages, Team } from "@/types/sports";
import Link from "next/link";
import { memo } from "react";
import { RankBadge } from "./RankBadge";

function isVolleyballPlayer(player: Player, avg: SeasonAverages): boolean {
  return (
    avg.killsPerSet !== undefined ||
    player.position === "OH" ||
    player.position === "MB" ||
    player.position === "S" ||
    player.position === "L" ||
    player.position === "OP"
  );
}

function getPlayerSummaryTiles(
  player: Player,
  avg: SeasonAverages,
  mode: "compact" | "full" = "compact"
) {
  const pos = (player.position || "OH").toUpperCase();
  const c = mode === "compact";

  if (isVolleyballPlayer(player, avg)) {
    if (pos.startsWith("L")) {
      return [
        { label: c ? "DIG/S" : "Digs / Set", value: formatAvg(avg.avgDig ?? avg.digsPerSet ?? 0), statKey: "avgDig" as const },
        { label: c ? "DIG%" : "Dig %", value: formatPct(avg.successDig ?? 0), statKey: "successDig" as const },
        { label: c ? "REC%" : "Rec %", value: formatPct(avg.successRec ?? 0), statKey: "successRec" as const },
      ];
    }
    if (pos.startsWith("S")) {
      return [
        { label: c ? "SET/S" : "Sets / Set", value: formatAvg(avg.avgSet ?? 0), statKey: "avgSet" as const },
        { label: c ? "SET%" : "Setting %", value: formatPct(avg.successSet ?? 0), statKey: "successSet" as const },
        { label: c ? "DIG/S" : "Digs / Set", value: formatAvg(avg.avgDig ?? 0), statKey: "avgDig" as const },
      ];
    }
    if (pos.startsWith("MB")) {
      return [
        { label: c ? "PTS/S" : "PTS / Set", value: formatAvg(avg.avgPerSet ?? avg.ppg ?? 0), statKey: "avgPerSet" as const },
        { label: c ? "BLK/S" : "Blocks / Set", value: formatAvg(avg.avgBlk ?? avg.blocksPerSet ?? 0), statKey: "avgBlk" as const },
        { label: c ? "ATK%" : "Atk Eff", value: formatPct(avg.efficiencyAtk ?? avg.attackPct ?? 0), statKey: "efficiencyAtk" as const },
      ];
    }
    return [
      { label: c ? "PTS/S" : "PTS / Set", value: formatAvg(avg.avgPerSet ?? avg.ppg ?? 0), statKey: "avgPerSet" as const },
      { label: c ? "ATK%" : "Atk Eff", value: formatPct(avg.efficiencyAtk ?? avg.attackPct ?? 0), statKey: "efficiencyAtk" as const },
      { label: c ? "KIL/S" : "Kills / Set", value: formatAvg(avg.avgAtk ?? avg.killsPerSet ?? 0), statKey: "avgAtk" as const },
    ];
  }

  return c
    ? [
        { label: "PPG", value: formatAvg(avg.ppg), statKey: "ppg" as const },
        { label: "RPG", value: formatAvg(avg.rpg), statKey: "rpg" as const },
        { label: "APG", value: formatAvg(avg.apg), statKey: "apg" as const },
      ]
    : [
        { label: "PPG", value: formatAvg(avg.ppg), statKey: "ppg" as const },
        { label: "FG%", value: formatPct(avg.fgPct), statKey: "fgPct" as const },
        { label: "APG", value: formatAvg(avg.apg), statKey: "apg" as const },
      ];
}

function StatGrid({ player, averages }: { player: Player; averages?: SeasonAverages }) {
  const { getPlayerAverages, getPlayerStatRank } = useSportsData();
  const avg = averages || getPlayerAverages(player);
  const tiles = getPlayerSummaryTiles(player, avg, "full");

  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map((tile) => {
        const rank = getPlayerStatRank(player.id, tile.statKey);
        return (
          <StatTile
            key={tile.label}
            label={tile.label}
            value={tile.value}
            size="sm"
            className="items-center text-center"
            badge={
              rank ? (
                <Badge tone="primary" size="sm" className="px-1.5 tabular-nums">
                  #{rank}
                </Badge>
              ) : null
            }
          />
        );
      })}
    </div>
  );
}

interface PlayerCardProps {
  player: Player;
  team: Team;
  variant?: "compact" | "full";
  showRankBadge?: boolean;
  activeContextLabel?: string;
  inactivePillTag?: string;
  customAverages?: SeasonAverages;
}

export const PlayerCard = memo(function PlayerCard({
  player,
  team,
  variant = "compact",
  activeContextLabel,
  inactivePillTag,
  customAverages,
}: PlayerCardProps) {

  const { getPlayerAverages } = useSportsData();
  const stats = getPlayerAverages(player);

  if (variant === "compact") {
    const compactTiles = getPlayerSummaryTiles(player, stats);
    return (
      <Link
        href={`/players/${player.id}`}
        className={cardClasses({
          interactive: true,
          className:
            "group relative flex flex-col justify-between gap-3 overflow-hidden p-4",
        })}
        style={{
          backgroundImage: `radial-gradient(ellipse 80% 65% at 100% 0%, ${team.accentColor}22, transparent 62%)`,
        }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[3px] opacity-80 transition-opacity group-hover:opacity-100"
          style={{ backgroundColor: team.accentColor }}
        />
        <span
          aria-hidden="true"
          className="font-display pointer-events-none absolute right-3 top-1 select-none text-4xl font-black tabular-nums text-foreground opacity-[0.06]"
        >
          #{player.jerseyNumber}
        </span>
        <div className="relative z-10 flex items-center gap-3">
          <div className="shrink-0">
            <PlayerAvatar player={player} accentColor={team.accentColor} size="md" />
          </div>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-extrabold text-foreground transition-colors group-hover:text-primary">
              {player.name}
            </span>
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-2xs font-medium text-muted">
              <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono font-bold text-foreground/90">
                #{player.jerseyNumber}
              </span>
              <span className="font-semibold uppercase tracking-wide">{player.position}</span>
              <span aria-hidden="true">&middot;</span>
              <span className="flex shrink-0 items-center gap-1">
                <TeamBadge team={team} size="sm" className="h-4 w-4 text-[7px]" />
                <span className="font-bold text-foreground/90">{team.shortName}</span>
              </span>
            </span>
          </span>
        </div>
        <div className="relative z-10 grid grid-cols-3 gap-1.5 border-t border-border/60 pt-2.5">
          {compactTiles.map((tile) => (
            <div
              key={tile.label}
              className="rounded-control border border-border/65 bg-surface-2/85 px-2 py-1.5 text-center"
            >
              <span className="font-display block text-base font-extrabold tabular-nums leading-none text-foreground">
                {tile.value}
              </span>
              <span className="mt-0.5 block text-3xs font-bold uppercase tracking-wider text-muted">
                {tile.label}
              </span>
            </div>
          ))}
        </div>
      </Link>
    );
  }

  return (
    <div
      className={cardClasses({ className: "relative flex flex-col gap-4 overflow-hidden p-5 sm:p-6" })}
      style={{
        backgroundImage: `radial-gradient(ellipse 75% 65% at 100% 0%, ${team.accentColor}24, transparent 60%)`,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-0.5"
        style={{ backgroundColor: team.accentColor }}
      />
      <div className="flex items-center gap-4">
        <PlayerAvatar player={player} accentColor={team.accentColor} size="lg" className="text-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display truncate text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{player.name}</h1>
            {inactivePillTag ? (
              <Badge tone="archive" size="md">
                {inactivePillTag}
              </Badge>
            ) : activeContextLabel ? (
              <Badge tone="primary" size="md">
                {activeContextLabel}
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm font-semibold text-muted">
            #{player.jerseyNumber} &middot; {player.position}{player.height ? ` · ${player.height}` : ""}
          </p>
          <Link href={`/teams/${team.id}`} className="mt-2 inline-flex items-center gap-1.5 rounded-control py-0.5 transition-colors hover:text-foreground">
            <TeamBadge team={team} size="sm" />
            <LeagueBadge league={team.league} />
            <span className="truncate text-xs font-semibold text-muted hover:text-foreground">{team.name}</span>
          </Link>
        </div>
      </div>

      {player.rankBadges.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {player.rankBadges.map((badge, index) => (
            <RankBadge key={badge.label} badge={badge} index={index} />
          ))}
        </div>
      ) : null}

      <StatGrid player={player} averages={customAverages} />
    </div>
  );
});
