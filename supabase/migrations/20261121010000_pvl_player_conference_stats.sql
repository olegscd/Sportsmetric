-- Official PVL player statistics, one row per player per conference.
-- Only counting stats are stored; averages, success/efficiency rates and the
-- career line are derived on read (lib/pvl-player-stats.ts). Refreshed from
-- pvl.ph by `npm run pvl:stats`; replaces the static JSON shipped to browsers.

CREATE TABLE IF NOT EXISTS public.pvl_player_conference_stats (
  player_slug     text NOT NULL CHECK (player_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  conference_id   integer NOT NULL CHECK (conference_id > 0),
  conference_name text NOT NULL,
  player_name     text NOT NULL,
  team            text,
  position        text,
  jersey          integer CHECK (jersey IS NULL OR jersey > 0),
  height          text,
  school          text,
  stats           jsonb NOT NULL CHECK (jsonb_typeof(stats) = 'object'),
  source          text NOT NULL DEFAULT 'pvl.ph' CHECK (source IN ('pvl.ph', 'snapshot-2026-08')),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_slug, conference_id)
);

CREATE INDEX IF NOT EXISTS pvl_player_conference_stats_conference_idx
  ON public.pvl_player_conference_stats (conference_id);

ALTER TABLE public.pvl_player_conference_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pvl_player_conference_stats_public_read ON public.pvl_player_conference_stats;
CREATE POLICY pvl_player_conference_stats_public_read ON public.pvl_player_conference_stats FOR SELECT USING (true);
REVOKE ALL ON public.pvl_player_conference_stats FROM anon, authenticated;
GRANT SELECT ON public.pvl_player_conference_stats TO anon, authenticated;
GRANT ALL ON public.pvl_player_conference_stats TO service_role;
