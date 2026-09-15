/**
 * Stable, human-readable game ids used by the importer, schedule builder,
 * and manual game form. Collisions (same teams, same day) get a numeric suffix
 * so a second fixture does not silently overwrite the first.
 */
export function buildGameId(opts: {
  league: string;
  seasonId: string;
  homeShort: string;
  awayShort: string;
  startTimeIso: string;
  claimedIds: Iterable<string>;
}): string {
  const dateSlug = opts.startTimeIso.slice(0, 10);
  const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const baseId = `${opts.league.toLowerCase()}-${opts.seasonId}-${slug(opts.homeShort)}-vs-${slug(opts.awayShort)}-${dateSlug}`;
  const claimed = opts.claimedIds instanceof Set ? opts.claimedIds : new Set(opts.claimedIds);
  let gameId = baseId;
  for (let suffix = 2; claimed.has(gameId); suffix++) {
    gameId = `${baseId}-${suffix}`;
  }
  return gameId;
}
