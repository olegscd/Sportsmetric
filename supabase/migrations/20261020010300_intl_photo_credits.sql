-- Photo attribution for international athlete profiles. A photo may only be
-- stored when its credit, license/permission and source link are recorded, so
-- no portrait can be published without attributed rights information.
BEGIN;

ALTER TABLE public.intl_athletes
  ADD COLUMN IF NOT EXISTS photo_credit text,
  ADD COLUMN IF NOT EXISTS photo_license text,
  ADD COLUMN IF NOT EXISTS photo_source_url text;

ALTER TABLE public.intl_athletes DROP CONSTRAINT IF EXISTS intl_athletes_photo_source_https;
ALTER TABLE public.intl_athletes ADD CONSTRAINT intl_athletes_photo_source_https
  CHECK (photo_source_url IS NULL OR photo_source_url ~ '^https://');

ALTER TABLE public.intl_athletes DROP CONSTRAINT IF EXISTS intl_athletes_photo_attribution_required;
ALTER TABLE public.intl_athletes ADD CONSTRAINT intl_athletes_photo_attribution_required
  CHECK (
    photo_url IS NULL OR (
      photo_credit IS NOT NULL AND btrim(photo_credit) <> ''
      AND photo_license IS NOT NULL AND btrim(photo_license) <> ''
      AND photo_source_url IS NOT NULL AND photo_source_url ~ '^https://'
    )
  );

COMMIT;
