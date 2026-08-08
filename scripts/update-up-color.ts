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
  // Update all UP teams in Supabase database to #8C0902
  const { data, error } = await supabase
    .from("teams")
    .update({ accent_color: "#8C0902" })
    .or("id.eq.up,id.ilike.up-%");

  if (error) {
    console.error("Error updating UP team color in Supabase:", error.message);
  } else {
    console.log("Successfully updated UP team accent_color to #8C0902 Garnet Red in Supabase!");
  }
}

main().catch(console.error);
