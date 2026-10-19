import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { BUNDLED_ATHLETE_PHOTOS } from "../lib/international-photos";

// Load .env.local for CLI usage (Next.js loads this automatically in dev/build).
const envPath = path.resolve(".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Writes need the service-role key: the anon key is read-only under RLS.
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  let failed = false;
  for (const [id, photo] of Object.entries(BUNDLED_ATHLETE_PHOTOS)) {
    const { data, error } = await supabase
      .from("intl_athletes")
      .update({
        photo_url: photo.photoUrl,
        photo_credit: photo.photoCredit,
        photo_license: photo.photoLicense,
        photo_source_url: photo.photoSourceUrl,
      })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "PGRST204" || /photo_(credit|license|source_url)/.test(error.message)) {
        console.error("Photo attribution columns are missing. Apply supabase/migrations/20261020010300_intl_photo_credits.sql first.");
        process.exit(1);
      }
      failed = true;
      console.error(`[${id}] ${error.message}`);
      continue;
    }
    if (!data) {
      failed = true;
      console.error(`[${id}] no athlete row found`);
      continue;
    }
    console.log(`Updated ${id}`);
  }
  if (failed) process.exit(1);
  console.log(`Seeded ${Object.keys(BUNDLED_ATHLETE_PHOTOS).length} athlete photos.`);
}

main();
