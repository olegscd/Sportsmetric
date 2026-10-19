import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Build with fixture-only public configuration, then test the production CSP
// and hydration behavior. The user's .env.local is never modified.
const next = fileURLToPath(new URL("../../node_modules/next/dist/bin/next", import.meta.url));
const build = spawn(process.execPath, [next, "build"], { stdio: "inherit", windowsHide: true });
const code = await new Promise(resolve => build.once("exit", resolve));
if (code !== 0) process.exit(code ?? 1);
const server = spawn(process.execPath, [next, "start", "--hostname", "127.0.0.1", "--port", "3100"], {
  stdio: "inherit", windowsHide: true,
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { server.kill(); process.exit(); });
server.once("exit", code => process.exit(code ?? 0));
