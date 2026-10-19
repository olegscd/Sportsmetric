import { defineConfig, devices } from "@playwright/test";
import { scryptSync } from "node:crypto";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    { command: "npx tsx tests/support/supabase.ts", url: "http://127.0.0.1:54329/health", reuseExistingServer: false },
    { command: "node tests/support/start-app.mjs", url: "http://127.0.0.1:3100", reuseExistingServer: false,
      timeout: 120000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "smoke-anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "smoke-service-key",
        ADMIN_PASSWORD_HASH: `scrypt$smoke-salt$${scryptSync("smoke-test-password", "smoke-salt", 64).toString("hex")}`,
      },
    },
  ],
});
