-- Enable Row Level Security on all tables
-- Anonymous (anon) users can READ but NOT write.
-- Run this migration in the Supabase SQL Editor.

-- === SEASONS ===
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on seasons" ON public.seasons;
CREATE POLICY "Allow public read access on seasons"
  ON public.seasons FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Block anon writes on seasons" ON public.seasons;
CREATE POLICY "Block anon writes on seasons"
  ON public.seasons FOR ALL
  USING (auth.role() != 'anon');

-- === TEAMS ===
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on teams" ON public.teams;
CREATE POLICY "Allow public read access on teams"
  ON public.teams FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Block anon writes on teams" ON public.teams;
CREATE POLICY "Block anon writes on teams"
  ON public.teams FOR ALL
  USING (auth.role() != 'anon');

-- === PLAYERS ===
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on players" ON public.players;
CREATE POLICY "Allow public read access on players"
  ON public.players FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Block anon writes on players" ON public.players;
CREATE POLICY "Block anon writes on players"
  ON public.players FOR ALL
  USING (auth.role() != 'anon');

-- === GAMES ===
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on games" ON public.games;
CREATE POLICY "Allow public read access on games"
  ON public.games FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Block anon writes on games" ON public.games;
CREATE POLICY "Block anon writes on games"
  ON public.games FOR ALL
  USING (auth.role() != 'anon');
