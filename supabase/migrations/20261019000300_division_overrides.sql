BEGIN;
CREATE TABLE public.uaap_division_overrides (
  season text NOT NULL,
  sport text NOT NULL,
  division text NOT NULL,
  payload jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (season, sport, division)
);
ALTER TABLE public.uaap_division_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY division_overrides_public_read ON public.uaap_division_overrides FOR SELECT USING (true);
GRANT SELECT ON public.uaap_division_overrides TO anon, authenticated;
GRANT ALL ON public.uaap_division_overrides TO service_role;

-- The old blob stays readable as a fallback. Copy every edited division,
-- including extras-only entries and tombstones, without changing its format.
WITH source AS (SELECT payload FROM public.uaap_overrides WHERE id = 'default'),
keys AS (
  SELECT jsonb_object_keys(coalesce(payload->'tables_overrides', '{}')) AS key FROM source
  UNION SELECT jsonb_object_keys(coalesce(payload->'standings_overrides', '{}')) FROM source
  UNION SELECT jsonb_array_elements_text(coalesce(payload->'deleted_divisions', '[]')) FROM source
  UNION SELECT split_part(e.key, '|', 2) || '|' || split_part(e.key, '|', 1) || '|' || d.key
    FROM source, LATERAL jsonb_each(coalesce(payload->'extras_overrides'->'awards', '{}')) e,
    LATERAL jsonb_each(e.value) d
  UNION SELECT split_part(e.key, '|', 2) || '|' || split_part(e.key, '|', 1) || '|' || d.key
    FROM source, LATERAL jsonb_each(coalesce(payload->'extras_overrides'->'chess_medalists', '{}')) e,
    LATERAL jsonb_each(e.value) d
)
INSERT INTO public.uaap_division_overrides(season, sport, division, payload)
SELECT split_part(key, '|', 1), split_part(key, '|', 2), split_part(key, '|', 3),
  jsonb_strip_nulls(jsonb_build_object(
    'table', s.payload->'tables_overrides'->key,
    'standings', s.payload->'standings_overrides'->key,
    'deleted', coalesce((s.payload->'deleted_divisions') ? key, false),
    'awards', s.payload->'extras_overrides'->'awards'->
      (split_part(key, '|', 2) || '|' || split_part(key, '|', 1))->split_part(key, '|', 3),
    'chess_medalists', s.payload->'extras_overrides'->'chess_medalists'->
      (split_part(key, '|', 2) || '|' || split_part(key, '|', 1))->split_part(key, '|', 3)
  )) FROM keys CROSS JOIN source s;

CREATE FUNCTION public.save_uaap_division(
  target_season text, target_sport text, target_division text,
  changes jsonb, expected_version integer
) RETURNS integer LANGUAGE plpgsql SET search_path = public AS $$
DECLARE next_version integer;
BEGIN
  IF expected_version = 0 THEN
    INSERT INTO public.uaap_division_overrides(season, sport, division, payload)
      VALUES (target_season, target_sport, target_division, changes)
      ON CONFLICT DO NOTHING RETURNING version INTO next_version;
  ELSE
    UPDATE public.uaap_division_overrides SET payload = payload || changes,
      version = version + 1, updated_at = now()
      WHERE season = target_season AND sport = target_sport AND division = target_division
        AND version = expected_version RETURNING version INTO next_version;
  END IF;
  IF next_version IS NULL THEN
    RAISE EXCEPTION 'This division was changed by another editor. Reload the archive before saving.'
      USING ERRCODE = '40001';
  END IF;
  RETURN next_version;
END;
$$;
REVOKE ALL ON FUNCTION public.save_uaap_division(text,text,text,jsonb,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_uaap_division(text,text,text,jsonb,integer) TO service_role;
COMMIT;
