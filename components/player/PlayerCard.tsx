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
  return (
    avg.killsPerSet !== undefined ||
    player.position === "OH" ||
    player.position === "MB" ||
    player.position === "S" ||
    player.position === "L" ||
    player.position === "OP"
  );
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
  activeContextLabel?: string;
  inactivePillTag?: string;
  customAverages?: SeasonAverages;
}

export function PlayerCard({
  player,
  team,
  variant = "compact",
  showRankBadge = true,
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
        className="flex items-center gap-3 rounded-2xl border border-stone-300/60 bg-[#F4EBD9] p-3 shadow-sm transition-transform active:scale-[0.99]"
      >
        <PlayerAvatar player={player} accentColor={team.accentColor} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-zinc-900">{player.name}</p>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-600 font-medium">
            <span>
              #{player.jerseyNumber} &middot; {player.position}
            </span>
            <span>&middot;</span>
            <div className="flex items-center gap-1.5">
              <TeamBadge team={team} size="sm" className="h-4 w-4 text-[8px]" />
              <span className="font-semibold text-zinc-800">{team.shortName}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-black tabular-nums text-zinc-950">
              {formatAvg(stats.ppg || stats.avgPerSet || 0)}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
              {stats.ppg !== undefined ? "PPG" : "PTS/S"}
            </p>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-stone-300/60 bg-[#F4EBD9] p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <PlayerAvatar player={player} accentColor={team.accentColor} size="lg" className="text-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="truncate text-lg font-extrabold text-zinc-950">{player.name}</p>
            {inactivePillTag ? (
              <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 shrink-0">
                {inactivePillTag}
              </span>
            ) : activeContextLabel ? (
              <span className="rounded-full bg-primary/15 border border-primary/30 px-2.5 py-0.5 text-[10px] font-bold text-primary shrink-0">
                {activeContextLabel}
              </span>
            ) : null}
          </div>
          <p className="text-sm font-semibold text-zinc-700 mt-0.5">
            #{player.jerseyNumber} &middot; {player.position} &middot; {player.height}
          </p>
          <Link href={`/teams/${team.id}`} className="mt-1.5 flex items-center gap-1.5">
            <TeamBadge team={team} size="sm" />
            <LeagueBadge league={team.league} />
            <span className="truncate text-xs font-semibold text-zinc-700">{team.name}</span>
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

      <StatGrid player={player} averages={customAverages} />
    </div>
  );
}
