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

function StatGrid({ player, averages }: { player: Player; averages?: SeasonAverages }) {
  const { getPlayerAverages, getPlayerStatRank } = useSportsData();
  const avg = averages || getPlayerAverages(player);
  const pos = (player.position || "OH").toUpperCase();

  let tiles;

  if (isVolleyballPlayer(player, avg)) {
    if (pos.startsWith("L")) {
      tiles = [
        {
          label: "Digs / Set",
          value: formatAvg(avg.avgDig ?? avg.digsPerSet ?? 0),
          statKey: "avgDig" as const,
        },
        {
          label: "Dig %",
          value: formatPct(avg.successDig ?? 0),
          statKey: "successDig" as const,
        },
        {
          label: "Rec %",
          value: formatPct(avg.successRec ?? 0),
          statKey: "successRec" as const,
        },
      ];
    } else if (pos.startsWith("S")) {
      tiles = [
        {
          label: "Sets / Set",
          value: formatAvg(avg.avgSet ?? 0),
          statKey: "avgSet" as const,
        },
        {
          label: "Setting %",
          value: formatPct(avg.successSet ?? 0),
          statKey: "successSet" as const,
        },
        {
          label: "Digs / Set",
          value: formatAvg(avg.avgDig ?? 0),
          statKey: "avgDig" as const,
        },
      ];
    } else if (pos.startsWith("MB")) {
      tiles = [
        {
          label: "PTS / Set",
          value: formatAvg(avg.avgPerSet ?? avg.ppg ?? 0),
          statKey: "avgPerSet" as const,
        },
        {
          label: "Blocks / Set",
          value: formatAvg(avg.avgBlk ?? avg.blocksPerSet ?? 0),
          statKey: "avgBlk" as const,
        },
        {
          label: "Atk Eff",
          value: formatPct(avg.efficiencyAtk ?? avg.attackPct ?? 0),
          statKey: "efficiencyAtk" as const,
        },
      ];
    } else {
      // OH / OP: PTS / SET, ATK EFF, KILLS / SET
      tiles = [
        {
          label: "PTS / Set",
          value: formatAvg(avg.avgPerSet ?? avg.ppg ?? 0),
          statKey: "avgPerSet" as const,
        },
        {
          label: "Atk Eff",
          value: formatPct(avg.efficiencyAtk ?? avg.attackPct ?? 0),
          statKey: "efficiencyAtk" as const,
        },
        {
          label: "Kills / Set",
          value: formatAvg(avg.avgAtk ?? avg.killsPerSet ?? 0),
          statKey: "avgAtk" as const,
        },
      ];
    }
  } else {
    // Basketball
    tiles = [
      { label: "PPG", value: formatAvg(avg.ppg), statKey: "ppg" as const },
      { label: "FG%", value: formatPct(avg.fgPct), statKey: "fgPct" as const },
      { label: "APG", value: formatAvg(avg.apg), statKey: "apg" as const },
    ];
  }

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
    return (
      <Link
        href={`/players/${player.id}`}
        className={cardClasses({
          interactive: true,
          className: "flex min-h-16 items-center gap-3 p-3",
        })}
      >
        <PlayerAvatar player={player} accentColor={team.accentColor} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-foreground">{player.name}</span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted">
            <span className="truncate">
              #{player.jerseyNumber} &middot; {player.position}
            </span>
            <span aria-hidden="true">&middot;</span>
            <span className="flex shrink-0 items-center gap-1.5">
              <TeamBadge team={team} size="sm" className="h-4 w-4 text-[8px]" />
              <span className="font-semibold text-foreground">{team.shortName}</span>
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="text-right">
            <span className="block text-sm font-black tabular-nums text-foreground">
              {formatAvg(stats.ppg || stats.avgPerSet || 0)}
            </span>
            <span className="block text-3xs font-bold uppercase tracking-wider text-muted">
              {stats.ppg !== undefined ? "PPG" : "PTS/S"}
            </span>
          </span>
        </span>
      </Link>
    );
  }

  return (
    <div className={cardClasses({ className: "flex flex-col gap-4 p-5" })}>
      <div className="flex items-center gap-4">
        <PlayerAvatar player={player} accentColor={team.accentColor} size="lg" className="text-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-lg font-extrabold tracking-tight text-foreground">{player.name}</h1>
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
            #{player.jerseyNumber} &middot; {player.position} &middot; {player.height}
          </p>
          <Link href={`/teams/${team.id}`} className="mt-1.5 flex items-center gap-1.5">
            <TeamBadge team={team} size="sm" />
            <LeagueBadge league={team.league} />
            <span className="truncate text-xs font-semibold text-muted">{team.name}</span>
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
