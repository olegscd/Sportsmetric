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
  // Test season upsert WITHOUT league column (fixed)
  const { error: seasonErr } = await supabase.from("seasons").upsert([{
    id: "__test_rls__",
    label: "Test Season",
    year: "__test_rls__",
    is_current: false,
  }]);
  if (seasonErr) {
    console.error("❌ SEASON WRITE ERROR:", seasonErr.message);
  } else {
    console.log("✅ Season write OK");
    await supabase.from("seasons").delete().eq("id", "__test_rls__");
    console.log("✅ Season delete OK");
  }

  // Test player upsert WITH all required fields
  const { data: existingPlayer } = await supabase.from("players").select("*").limit(1).single();
  if (existingPlayer) {
    // Upsert back with no changes (full record)
    const { error: playerErr } = await supabase.from("players").upsert([existingPlayer]);
    if (playerErr) {
      console.error("❌ PLAYER WRITE ERROR:", playerErr.message);
    } else {
      console.log("✅ Player upsert OK:", existingPlayer.name);
    }
  }

  // Test team upsert
  const { data: existingTeam } = await supabase.from("teams").select("*").limit(1).single();
  if (existingTeam) {
    const { error: teamErr } = await supabase.from("teams").upsert([existingTeam]);
    if (teamErr) {
      console.error("❌ TEAM WRITE ERROR:", teamErr.message);
    } else {
      console.log("✅ Team upsert OK:", existingTeam.name);
    }
  }
}

main().catch(console.error);
