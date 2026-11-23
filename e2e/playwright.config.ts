import { defineConfig, devices } from "@playwright/test";

/**
 * Hermetic E2E suite. The static server serves `out/`, and every backend call
 * is fulfilled by page.route (see helpers.ts). No wallet extension, backend or
 * network access is required.
 */
export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:8080",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node serve.mjs",
    url: "http://127.0.0.1:8080/healthz",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
