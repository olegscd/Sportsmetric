-- Add optional venue column to games and league column to seasons
-- Allows storing game venue and explicit league tags in database

ALTER TABLE public.games ADD COLUMN IF NOT EXISTS venue text;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS stage text;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS is_playoff boolean DEFAULT false;
ALTER TABLE public.seasons ADD COLUMN IF NOT EXISTS league text;

