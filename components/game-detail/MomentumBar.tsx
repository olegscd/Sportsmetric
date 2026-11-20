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
    <div className="flex flex-col gap-3.5">
      <div className="translucent-card rounded-card border border-white/[0.1] p-3.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-2xs font-bold uppercase tracking-wider text-muted">
            {heading}
          </p>
          <p className="text-2xs font-medium text-muted">{sublabel}</p>
        </div>
        <div
          role="img"
          aria-label={ariaLabel}
          className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.05] p-0.5 ring-1 ring-white/[0.08]"
        >
          {scoringEvents.length > 0 ? (
            scoringEvents.map((event) => (
              <div
                key={event.id}
                className="h-full flex-1 first:rounded-l-full last:rounded-r-full"
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
                className="h-full rounded-l-full"
                style={{
                  flexGrow: game.awayScore,
                  backgroundColor: game.awayTeam.accentColor,
                }}
              />
              <div
                className="h-full rounded-r-full"
                style={{
                  flexGrow: game.homeScore,
                  backgroundColor: game.homeTeam.accentColor,
                }}
              />
            </>
          ) : (
            <div className="h-full flex-1 rounded-full bg-border" />
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-2xs text-muted">
          <span className="flex items-center gap-1.5 truncate font-semibold">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: game.awayTeam.accentColor }} aria-hidden="true" />
            {game.awayTeam.shortName}
          </span>
          <span className="text-center font-bold text-foreground">{marginText}</span>
          <span className="flex items-center justify-end gap-1.5 truncate font-semibold">
            {game.homeTeam.shortName}
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: game.homeTeam.accentColor }} aria-hidden="true" />
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[game.awayTeam, game.homeTeam].map((team) => (
          <div
            key={team.id}
            className="translucent-card relative overflow-hidden rounded-card border border-white/[0.1] p-3"
          >
            <div
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1"
              style={{ backgroundColor: team.accentColor }}
            />
            <div className="pl-2">
              <p className="truncate text-xs font-bold text-foreground">{team.shortName}</p>
              <p className="text-2xs font-medium text-muted">{formatRecord(team.record)}</p>
            </div>
          </div>
        ))}
      </div>

      {awayTotals && homeTotals ? (
        <div className="translucent-card rounded-card border border-white/[0.1] p-3.5">
          <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-white/[0.07] pb-2 text-2xs font-bold uppercase tracking-wider text-muted">
            <span className="truncate">{game.awayTeam.shortName}</span>
            <span>Team Box Totals</span>
            <span className="truncate text-right">{game.homeTeam.shortName}</span>
          </div>
          <div className="space-y-2.5 text-xs">
            {[
              {
                label: "FG%",
                away: `${formatPct(awayTotals.fgPct)} (${awayTotals.fgM}/${awayTotals.fgA})`,
                home: `${formatPct(homeTotals.fgPct)} (${homeTotals.fgM}/${homeTotals.fgA})`,
                awayVal: awayTotals.fgPct,
                homeVal: homeTotals.fgPct,
              },
              {
                label: "3P%",
                away: `${formatPct(awayTotals.threePtPct)} (${awayTotals.threeM}/${awayTotals.threeA})`,
                home: `${formatPct(homeTotals.threePtPct)} (${homeTotals.threeM}/${homeTotals.threeA})`,
                awayVal: awayTotals.threePtPct,
                homeVal: homeTotals.threePtPct,
              },
              {
                label: "FT%",
                away: `${formatPct(awayTotals.ftPct)} (${awayTotals.ftM}/${awayTotals.ftA})`,
                home: `${formatPct(homeTotals.ftPct)} (${homeTotals.ftM}/${homeTotals.ftA})`,
                awayVal: awayTotals.ftPct,
                homeVal: homeTotals.ftPct,
              },
              { label: "REB", away: String(awayTotals.reb), home: String(homeTotals.reb), awayVal: awayTotals.reb, homeVal: homeTotals.reb },
              { label: "AST", away: String(awayTotals.ast), home: String(homeTotals.ast), awayVal: awayTotals.ast, homeVal: homeTotals.ast },
              { label: "STL", away: String(awayTotals.stl), home: String(homeTotals.stl), awayVal: awayTotals.stl, homeVal: homeTotals.stl },
              { label: "BLK", away: String(awayTotals.blk), home: String(homeTotals.blk), awayVal: awayTotals.blk, homeVal: homeTotals.blk },
              { label: "TO", away: String(awayTotals.to), home: String(homeTotals.to), awayVal: awayTotals.to, homeVal: homeTotals.to },
            ].map((row) => {
              const total = row.awayVal + row.homeVal;
              return (
                <div key={row.label} className="space-y-1">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 tabular-nums">
                    <span className="font-semibold text-foreground">{row.away}</span>
                    <span className="text-3xs font-bold uppercase tracking-wider text-muted">
                      {row.label}
                    </span>
                    <span className="text-right font-semibold text-foreground">{row.home}</span>
                  </div>
                  {total > 0 ? (
                    <div className="flex h-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full"
                        style={{
                          flexGrow: row.awayVal,
                          backgroundColor: game.awayTeam.accentColor,
                          opacity: row.awayVal >= row.homeVal ? 0.95 : 0.45,
                        }}
                      />
                      <div
                        className="h-full"
                        style={{
                          flexGrow: row.homeVal,
                          backgroundColor: game.homeTeam.accentColor,
                          opacity: row.homeVal >= row.awayVal ? 0.95 : 0.45,
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
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
