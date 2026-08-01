import { PlayerCard } from "@/components/player/PlayerCard";
import type { Player, Team } from "@/types/sports";

export function TeamRoster({ players, team }: { players: Player[]; team: Team }) {
  const roster = [...players].sort((a, b) => a.jerseyNumber - b.jerseyNumber);

  if (roster.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">No roster data yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {roster.map((player) => (
        <PlayerCard key={player.id} player={player} team={team} variant="compact" />
      ))}
    </div>
  );
}
