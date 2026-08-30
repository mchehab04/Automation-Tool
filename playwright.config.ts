import { defineConfig, devices } from "@playwright/test";

// Tests run against the real dev database (no separate test DB/fixtures
// exist yet) — serial, one worker, so tests that mutate shared data (the
// service catalogue, scheduling slots) can't race each other.
export default defineConfig({
  testDir: "./e2e",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 60_000, // several tests wait on real Anthropic API calls, some chained (pipeline.spec.ts)
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // Reuses whatever dev server is already running on this port; spawns one
  // otherwise (e.g. in CI).
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
