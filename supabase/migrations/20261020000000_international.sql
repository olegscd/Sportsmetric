-- International coverage: Filipino athletes competing abroad and for the
-- national team. Kept apart from the league tables (seasons/teams/players/games)
-- because placements, marks and rankings do not fit box scores or standings.
-- Every athlete and result must cite a public https source; nothing is visible
-- to the public until an editor sets `published`.
BEGIN;

CREATE TABLE IF NOT EXISTS public.intl_athletes (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(id) <= 120),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  sports text[] NOT NULL DEFAULT '{}',
  -- Nationality/heritage is separate from the country represented in a result.
  filipino_connection text NOT NULL
    CHECK (filipino_connection IN ('citizen', 'dual_citizen', 'naturalized', 'heritage')),
  connection_note text,
  connection_source_url text NOT NULL CHECK (connection_source_url ~ '^https://'),
  -- Optional link to the league career identity (players.person_id).
  person_id text,
  photo_url text,
  bio text,
  coverage_note text,
  published boolean NOT NULL DEFAULT false,
  reviewed_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.intl_competitions (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(id) <= 160),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  sport text NOT NULL,
  level text NOT NULL CHECK (level IN ('olympics', 'world_championship', 'continental', 'regional',
    'world_tour', 'international_club', 'foreign_league', 'foreign_collegiate', 'other')),
  host_country text,
  season text,
  start_date date,
  end_date date,
  source_url text CHECK (source_url IS NULL OR source_url ~ '^https://'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.intl_results (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 200),
  athlete_id text NOT NULL REFERENCES public.intl_athletes(id) ON UPDATE CASCADE ON DELETE CASCADE,
  competition_id text NOT NULL REFERENCES public.intl_competitions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  event text NOT NULL CHECK (length(btrim(event)) > 0),
  representation text NOT NULL CHECK (representation IN ('national_team', 'club', 'individual')),
  -- Country or club name as listed by the source for this entry.
  represented text NOT NULL CHECK (length(btrim(represented)) > 0),
  result_type text NOT NULL CHECK (result_type IN ('placement', 'mark', 'ranking', 'stat_line', 'award')),
  placement integer CHECK (placement IS NULL OR placement > 0),
  field_size integer CHECK (field_size IS NULL OR field_size > 0),
  medal text CHECK (medal IS NULL OR medal IN ('gold', 'silver', 'bronze')),
  mark_value numeric,
  mark_unit text,
  -- Per-game averages/totals for stat lines, e.g. {"gp":30,"ppg":12.4}.
  stats jsonb,
  -- What the figure covers: "Final", "Season average", "WTA singles ranking", ...
  scope text,
  result_date date,
  source_url text NOT NULL CHECK (source_url ~ '^https://'),
  source_publisher text,
  reviewed_at date,
  notes text,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (result_type <> 'placement' OR placement IS NOT NULL),
  CHECK (result_type <> 'ranking' OR placement IS NOT NULL),
  CHECK (result_type <> 'mark' OR (mark_value IS NOT NULL AND mark_unit IS NOT NULL)),
  CHECK (result_type <> 'stat_line' OR stats IS NOT NULL),
  CHECK (stats IS NULL OR jsonb_typeof(stats) = 'object'),
  CHECK (field_size IS NULL OR placement IS NULL OR placement <= field_size)
);

CREATE INDEX IF NOT EXISTS intl_results_athlete_idx ON public.intl_results(athlete_id, result_date DESC);
CREATE INDEX IF NOT EXISTS intl_results_competition_idx ON public.intl_results(competition_id);
CREATE INDEX IF NOT EXISTS intl_athletes_published_idx ON public.intl_athletes(published) WHERE published;

ALTER TABLE public.intl_athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intl_competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intl_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intl_athletes_public_read ON public.intl_athletes;
CREATE POLICY intl_athletes_public_read ON public.intl_athletes FOR SELECT USING (published);
DROP POLICY IF EXISTS intl_competitions_public_read ON public.intl_competitions;
CREATE POLICY intl_competitions_public_read ON public.intl_competitions FOR SELECT USING (true);
DROP POLICY IF EXISTS intl_results_public_read ON public.intl_results;
CREATE POLICY intl_results_public_read ON public.intl_results FOR SELECT USING (
  published AND EXISTS (SELECT 1 FROM public.intl_athletes a WHERE a.id = athlete_id AND a.published)
);

REVOKE ALL ON public.intl_athletes, public.intl_competitions, public.intl_results FROM anon, authenticated;
GRANT SELECT ON public.intl_athletes, public.intl_competitions, public.intl_results TO anon, authenticated;
GRANT ALL ON public.intl_athletes, public.intl_competitions, public.intl_results TO service_role;
COMMIT;
