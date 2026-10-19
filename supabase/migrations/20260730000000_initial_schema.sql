-- Bootstrap fresh databases before the older ALTER TABLE migrations.
CREATE TABLE IF NOT EXISTS public.seasons (
  id          text PRIMARY KEY,
  label       text NOT NULL,
  year        text NOT NULL DEFAULT '',
  is_current  boolean NOT NULL DEFAULT false,
  league      text,
  -- Admin-controlled display order. Without this the reorder buttons in the
  -- seasons tab had nowhere to save to, so the list always snapped back to
  -- id-descending on the next load.
  sort_order  integer
);

ALTER TABLE public.seasons ADD COLUMN IF NOT EXISTS sort_order integer;

-- Seed sort_order from the ordering the app used before (id descending).
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY id DESC) AS rn
  FROM public.seasons
  WHERE sort_order IS NULL
)
UPDATE public.seasons s
SET sort_order = ordered.rn
FROM ordered
WHERE s.id = ordered.id;

CREATE TABLE IF NOT EXISTS public.teams (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  short_name   text NOT NULL,
  logo         text,
  league       text NOT NULL,
  accent_color text NOT NULL DEFAULT '#6B7280',
  season_id    text NOT NULL,
  record       jsonb NOT NULL DEFAULT '{"wins": 0, "losses": 0}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.players (
  id              text PRIMARY KEY,
  person_id       text NOT NULL,
  name            text NOT NULL,
  jersey_number   integer NOT NULL DEFAULT 0,
  position        text NOT NULL DEFAULT 'SG',
  team_id         text NOT NULL,
  height          text NOT NULL DEFAULT '',
  photo_url       text,
  season_id       text NOT NULL,
  season_averages jsonb NOT NULL DEFAULT '{}'::jsonb,
  rank_badges     jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.games (
  id             text PRIMARY KEY,
  league         text NOT NULL,
  season_id      text NOT NULL,
  home_team_id   text NOT NULL,
  away_team_id   text NOT NULL,
  home_score     integer NOT NULL DEFAULT 0,
  away_score     integer NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'UPCOMING',
  start_time     timestamptz NOT NULL DEFAULT now(),
  quarter_or_set integer NOT NULL DEFAULT 0,
  time_remaining text,
  venue          text,
  stage          text,
  is_playoff     boolean DEFAULT false,
  box_score      jsonb NOT NULL DEFAULT '{"home": [], "away": []}'::jsonb,
  play_by_play   jsonb NOT NULL DEFAULT '[]'::jsonb
);
