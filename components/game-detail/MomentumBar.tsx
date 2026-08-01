import { formatRecord } from "@/lib/utils";
import type { Game } from "@/types/sports";

export function MomentumBar({ game }: { game: Game }) {
  const scoringEvents = game.playByPlay.filter((event) => event.scoringTeamId !== null);
  const diff = game.homeScore - game.awayScore;

  const leadText =
    diff === 0
      ? "Tied game"
      : `${diff > 0 ? game.homeTeam.shortName : game.awayTeam.shortName} leads by ${Math.abs(diff)}`;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Momentum
        </p>
        <div className="flex h-2 overflow-hidden rounded-full bg-elevated">
          {scoringEvents.length === 0 ? (
            <div className="h-full flex-1 bg-border" />
          ) : (
            scoringEvents.map((event) => (
              <div
                key={event.id}
                className="h-full flex-1"
                style={{
                  backgroundColor:
                    event.scoringTeamId === game.homeTeam.id
                      ? game.homeTeam.accentColor
                      : game.awayTeam.accentColor,
                }}
              />
            ))
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted">
          <span>{game.awayTeam.shortName}</span>
          <span className="font-semibold text-foreground">{leadText}</span>
          <span>{game.homeTeam.shortName}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[game.awayTeam, game.homeTeam].map((team) => (
          <div key={team.id} className="rounded-xl border border-border bg-surface p-3">
            <p className="text-xs font-semibold text-foreground">{team.shortName}</p>
            <p className="text-[11px] text-muted">{formatRecord(team.record)}</p>
          </div>
        ))}
      </div>

      {game.venue ? (
        <p className="text-xs text-muted">
          <span className="font-semibold text-foreground">Venue: </span>
          {game.venue}
        </p>
      ) : null}
    </div>
  );
}
