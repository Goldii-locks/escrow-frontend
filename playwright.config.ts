import { defineConfig, devices } from "@playwright/test";

// Smoke tests against the built static export served by nginx
// (see e2e/serve.sh). Run `npm run build` first.
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:8080",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "./e2e/serve.sh && tail -f /dev/null",
    url: "http://127.0.0.1:8080/healthz",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
