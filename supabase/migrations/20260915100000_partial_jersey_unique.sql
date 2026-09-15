-- Jersey 0 is used as "number unknown" when a box score has no jersey.
-- The previous unique index treated 0 like a real number, so ingesting a
-- second unmatched player on the same team failed the whole write.

DROP INDEX IF EXISTS public.uniq_players_team_season_jersey;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_players_team_season_jersey
  ON public.players (team_id, season_id, jersey_number)
  WHERE jersey_number > 0;
