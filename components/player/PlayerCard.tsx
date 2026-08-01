"use client";

import { LeagueBadge } from "@/components/match-center/LeagueBadge";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { useSportsData } from "@/context/SportsDataContext";
import { formatAvg, formatPct } from "@/lib/utils";
import type { Player, SeasonAverages, Team } from "@/types/sports";
import Link from "next/link";
import { RankBadge } from "./RankBadge";

function isVolleyballPlayer(player: Player, avg: SeasonAverages): boolean {
  return avg.killsPerSet !== undefined || player.position === "OH" || player.position === "MB" || player.position === "S" || player.position === "L" || player.position === "OP";
}

function StatTile({
  label,
  value,
  rank,
}: {
  label: string;
  value: string;
  rank?: number;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-elevated py-2.5">
      <span className="text-base font-bold tabular-nums text-foreground">{value}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      {rank ? (
        <span className="mt-1 rounded-full bg-primary/15 px-1.5 py-px text-[9px] font-bold tabular-nums text-primary">
          #{rank}
        </span>
      ) : null}
    </div>
  );
}

function StatGrid({ player }: { player: Player }) {
  const { getPlayerAverages, getPlayerStatRank } = useSportsData();
  const avg = getPlayerAverages(player);

  const tiles = isVolleyballPlayer(player, avg)
    ? [
        {
          label: "Kills/Set",
          value: formatAvg(avg.killsPerSet ?? 0),
          statKey: "killsPerSet" as const,
        },
        {
          label: "Digs/Set",
          value: formatAvg(avg.digsPerSet ?? 0),
          statKey: "digsPerSet" as const,
        },
        {
          label: "Blocks/Set",
          value: formatAvg(avg.blocksPerSet ?? 0),
          statKey: "blocksPerSet" as const,
        },
      ]
    : [
        { label: "PPG", value: formatAvg(avg.ppg), statKey: "ppg" as const },
        { label: "RPG", value: formatAvg(avg.rpg), statKey: "rpg" as const },
        { label: "APG", value: formatAvg(avg.apg), statKey: "apg" as const },
        { label: "SPG", value: formatAvg(avg.spg), statKey: "spg" as const },
        { label: "BPG", value: formatAvg(avg.bpg), statKey: "bpg" as const },
        { label: "3P%", value: formatPct(avg.threePtPct), statKey: "threePtPct" as const },
      ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map((tile) => (
        <StatTile
          key={tile.label}
          label={tile.label}
          value={tile.value}
          rank={getPlayerStatRank(player.id, tile.statKey)}
        />
      ))}
    </div>
  );
}

interface PlayerCardProps {
  player: Player;
  team: Team;
  variant?: "compact" | "full";
  showRankBadge?: boolean;
}

export function PlayerCard({
  player,
  team,
  variant = "compact",
  showRankBadge = true,
}: PlayerCardProps) {
  if (variant === "compact") {
    return (
      <Link
        href={`/players/${player.id}`}
        className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition-colors hover:bg-surface/80"
      >
        <PlayerAvatar player={player} accentColor={team.accentColor} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{player.name}</p>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            <span>#{player.jerseyNumber} &middot; {player.position}</span>
            <span>&middot;</span>
            <div className="flex items-center gap-1.5">
              <TeamBadge team={team} size="sm" className="h-4 w-4 text-[8px]" />
              <span className="font-medium text-foreground/80">{team.shortName}</span>
            </div>
          </div>
        </div>
        {showRankBadge && player.rankBadges[0] ? (
          <RankBadge badge={player.rankBadges[0]} compact />
        ) : null}
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-4">
        <PlayerAvatar player={player} accentColor={team.accentColor} size="lg" className="text-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold text-foreground">{player.name}</p>
          <p className="text-sm text-muted">
            #{player.jerseyNumber} &middot; {player.position} &middot; {player.height}
          </p>
          <Link href={`/teams/${team.id}`} className="mt-1.5 flex items-center gap-1.5">
            <TeamBadge team={team} size="sm" />
            <LeagueBadge league={team.league} />
            <span className="truncate text-xs text-muted font-medium">{team.name}</span>
          </Link>
        </div>
      </div>

      {player.rankBadges.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {player.rankBadges.map((badge) => (
            <RankBadge key={badge.label} badge={badge} />
          ))}
        </div>
      ) : null}

      <StatGrid player={player} />
    </div>
  );
}
