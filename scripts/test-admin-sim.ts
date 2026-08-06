import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(url, key);

async function main() {
  console.log("--- TEST ADMIN SIMULATION ---");
  
  // 1. Add Season 89 as current = true
  const newSeason = {
    id: "2026-27",
    label: "2026-27 Season (UAAP S89)",
    year: "2026-27",
    is_current: true
  };
  const oldSeason = {
    id: "2025-26",
    label: "2025-26 Season (UAAP S88)",
    year: "2025-26",
    is_current: false
  };

  const { error: upsertErr } = await supabase.from("seasons").upsert([newSeason, oldSeason]);
  console.log("Upsert Season 89 & 88 result:", upsertErr ? upsertErr.message : "SUCCESS");

  // 2. Fetch seasons back from Supabase
  const { data: fetchedSeasons } = await supabase.from("seasons").select("*").order("id", { ascending: false });
  console.log("Fetched seasons from DB:", fetchedSeasons);
}

main().catch(console.error);
