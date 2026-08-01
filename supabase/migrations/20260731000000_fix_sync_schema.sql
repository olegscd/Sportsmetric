-- Align schema with client sync layer

-- seasons.year is NOT NULL but client never sent it; derive default from id
ALTER TABLE public.seasons ALTER COLUMN year SET DEFAULT '';
UPDATE public.seasons SET year = id WHERE year IS NULL OR year = '';

-- games.play_by_play is read by client but was missing from table
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS play_by_play jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Ensure Realtime publication includes all tables (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'seasons'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.seasons;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'teams'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'games'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
  END IF;
END $$;
