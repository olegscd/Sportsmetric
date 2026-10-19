import { PlayerCard } from "@/components/player/PlayerCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Player, Team } from "@/types/sports";
import { Users } from "lucide-react";

export function TeamRoster({ players, team }: { players: Player[]; team: Team }) {
  const roster = [...players].sort((a, b) => a.jerseyNumber - b.jerseyNumber);

  if (roster.length === 0) {
    return (
      <EmptyState
        icon={<Users size={22} aria-hidden="true" />}
        title="No roster data yet."
        description="Player cards appear here once the roster has been published."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {roster.map((player) => (
        <PlayerCard key={player.id} player={player} team={team} variant="compact" />
      ))}
    </div>
  );
}
