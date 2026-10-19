-- Older deployments store games.start_time as ISO text. Normalize at the RPC
-- boundary instead of rewriting the live column or losing existing fixtures.
DO $migration$
DECLARE definition text;
BEGIN
  definition := pg_get_functiondef('public.game_sync_snapshot(public.games)'::regprocedure);
  definition := replace(definition, $old$'start_time',g.start_time,$old$, $new$'start_time',g.start_time::timestamptz,$new$);
  definition := replace(definition, 'IMMUTABLE', 'STABLE');
  EXECUTE definition;
  definition := pg_get_functiondef('public.apply_game_sync(uuid,text,text,jsonb,jsonb)'::regprocedure);
  definition := replace(definition, 'next_game.start_time AT TIME ZONE', 'next_game.start_time::timestamptz AT TIME ZONE');
  EXECUTE definition;
END $migration$;
