-- Add the foreign keys the original schema was missing.
--
-- Constraints are added NOT VALID so pre-existing orphan rows do not block the
-- migration; PostgreSQL still enforces them for every INSERT/UPDATE. Run
-- `VALIDATE CONSTRAINT` after cleaning any legacy orphans.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_season_fk') THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_season_fk
      FOREIGN KEY (season_id) REFERENCES public.seasons (id) ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'players_season_fk') THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_season_fk
      FOREIGN KEY (season_id) REFERENCES public.seasons (id) ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'players_team_fk') THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_team_fk
      FOREIGN KEY (team_id) REFERENCES public.teams (id) ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'games_season_fk') THEN
    ALTER TABLE public.games
      ADD CONSTRAINT games_season_fk
      FOREIGN KEY (season_id) REFERENCES public.seasons (id) ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'games_home_team_fk') THEN
    ALTER TABLE public.games
      ADD CONSTRAINT games_home_team_fk
      FOREIGN KEY (home_team_id) REFERENCES public.teams (id) ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'games_away_team_fk') THEN
    ALTER TABLE public.games
      ADD CONSTRAINT games_away_team_fk
      FOREIGN KEY (away_team_id) REFERENCES public.teams (id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END
$$;
