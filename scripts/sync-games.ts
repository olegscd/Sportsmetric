import { loadEnvConfig } from "@next/env";
import { runGameSync } from "@/lib/game-sync/run";

loadEnvConfig(process.cwd());
const preview = !process.argv.includes("--write");
runGameSync({ preview }).then(result => {
  console.log(JSON.stringify(result, null, 2));
  if ("status" in result && result.status === "failed") process.exitCode = 1;
}).catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
