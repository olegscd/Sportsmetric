import { describeGameMargin, summarizeTeamBoxScore } from "@/lib/game-overview";
import { formatPct, formatRecord } from "@/lib/utils";
import type { Game, PlayByPlayEvent } from "@/types/sports";

export function MomentumBar({
  game,
  playByPlay,
}: {
  game: Game;
  playByPlay?: PlayByPlayEvent[];
}) {
  const events = playByPlay ?? game.playByPlay;
  const scoringEvents = events.filter((event) => event.scoringTeamId !== null);
  const marginText = describeGameMargin(game);
  const totalScore = game.homeScore + game.awayScore;
  const hasTeamBoxTotals =
    game.league !== "PVL" &&
    game.boxScore.away.length > 0 &&
    game.boxScore.home.length > 0;
  const awayTotals = hasTeamBoxTotals ? summarizeTeamBoxScore(game.boxScore.away) : null;
  const homeTotals = hasTeamBoxTotals ? summarizeTeamBoxScore(game.boxScore.home) : null;

  const heading =
    scoringEvents.length > 0
      ? "Momentum"
      : totalScore > 0
        ? "Score Share"
        : "Matchup";
  const sublabel =
    scoringEvents.length > 0
      ? "Scoring sequence"
      : totalScore > 0
        ? `${game.awayScore}–${game.homeScore}`
        : "Pre-game";
  const ariaLabel =
    scoringEvents.length > 0
      ? `Scoring sequence for ${game.awayTeam.shortName} at ${game.homeTeam.shortName}: ${scoringEvents.length} scoring events. ${marginText}.`
      : totalScore > 0
        ? `Score share for ${game.awayTeam.shortName} at ${game.homeTeam.shortName}: ${game.awayScore} to ${game.homeScore}. ${marginText}.`
        : `${game.awayTeam.shortName} at ${game.homeTeam.shortName}: ${marginText}.`;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-2xs font-semibold uppercase tracking-wide text-muted">
            {heading}
          </p>
          <p className="text-2xs text-muted">{sublabel}</p>
        </div>
        <div
          role="img"
          aria-label={ariaLabel}
          className="flex h-2 overflow-hidden rounded-full bg-surface-2"
        >
          {scoringEvents.length > 0 ? (
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
          ) : totalScore > 0 ? (
            <>
              <div
                className="h-full"
                style={{
                  flexGrow: game.awayScore,
                  backgroundColor: game.awayTeam.accentColor,
                }}
              />
              <div
                className="h-full"
                style={{
                  flexGrow: game.homeScore,
                  backgroundColor: game.homeTeam.accentColor,
                }}
              />
            </>
          ) : (
            <div className="h-full flex-1 bg-border" />
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-2xs text-muted">
          <span className="truncate">{game.awayTeam.shortName}</span>
          <span className="text-center font-semibold text-foreground">{marginText}</span>
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

      {awayTotals && homeTotals ? (
        <div className="rounded-card border border-border bg-surface p-3">
          <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border/60 pb-2 text-2xs font-semibold uppercase tracking-wide text-muted">
            <span className="truncate">{game.awayTeam.shortName}</span>
            <span>Team Box Totals</span>
            <span className="truncate text-right">{game.homeTeam.shortName}</span>
          </div>
          <div className="space-y-1.5 text-xs">
            {[
              {
                label: "FG%",
                away: `${formatPct(awayTotals.fgPct)} (${awayTotals.fgM}/${awayTotals.fgA})`,
                home: `${formatPct(homeTotals.fgPct)} (${homeTotals.fgM}/${homeTotals.fgA})`,
              },
              {
                label: "3P%",
                away: `${formatPct(awayTotals.threePtPct)} (${awayTotals.threeM}/${awayTotals.threeA})`,
                home: `${formatPct(homeTotals.threePtPct)} (${homeTotals.threeM}/${homeTotals.threeA})`,
              },
              {
                label: "FT%",
                away: `${formatPct(awayTotals.ftPct)} (${awayTotals.ftM}/${awayTotals.ftA})`,
                home: `${formatPct(homeTotals.ftPct)} (${homeTotals.ftM}/${homeTotals.ftA})`,
              },
              { label: "REB", away: String(awayTotals.reb), home: String(homeTotals.reb) },
              { label: "AST", away: String(awayTotals.ast), home: String(homeTotals.ast) },
              { label: "STL", away: String(awayTotals.stl), home: String(homeTotals.stl) },
              { label: "BLK", away: String(awayTotals.blk), home: String(homeTotals.blk) },
              { label: "TO", away: String(awayTotals.to), home: String(homeTotals.to) },
            ].map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 tabular-nums"
              >
                <span className="text-foreground">{row.away}</span>
                <span className="text-2xs font-semibold uppercase tracking-wide text-muted">
                  {row.label}
                </span>
                <span className="text-right text-foreground">{row.home}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {game.venue ? (
        <p className="text-xs text-muted">
          <span className="font-semibold text-foreground">Venue: </span>
          {game.venue}
        </p>
      ) : null}
    </div>
  );
}
