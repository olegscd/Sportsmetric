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
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-2xs font-semibold uppercase tracking-wide text-muted">
            Momentum
          </p>
          <p className="text-2xs text-muted">Scoring sequence</p>
        </div>
        <div
          role="img"
          aria-label={`Scoring sequence for ${game.awayTeam.shortName} at ${game.homeTeam.shortName}: ${scoringEvents.length} scoring events. ${leadText}.`}
          className="flex h-2 overflow-hidden rounded-full bg-surface-2"
        >
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
        <div className="mt-1.5 flex items-center justify-between gap-2 text-2xs text-muted">
          <span className="truncate">{game.awayTeam.shortName}</span>
          <span className="text-center font-semibold text-foreground">{leadText}</span>
          <span className="truncate text-right">{game.homeTeam.shortName}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[game.awayTeam, game.homeTeam].map((team) => (
          <div key={team.id} className="rounded-card border border-border bg-surface p-3">
            <p className="truncate text-xs font-semibold text-foreground">{team.shortName}</p>
            <p className="text-2xs text-muted">{formatRecord(team.record)}</p>
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
