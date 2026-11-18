import { test, expect, type Page } from "@playwright/test";

// Block anything that leaves the static site (backend API, Soroban RPC,
// Horizon, wallet extensions' remote endpoints) so the smoke run is
// hermetic. Same-origin /api/ calls get an empty success payload.
test.beforeEach(async ({ page, baseURL }) => {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(`${baseURL}/api/`)) {
      return route.fulfill({ json: { success: true, data: [] } });
    }
    if (url.startsWith(baseURL!) || url.startsWith("data:")) {
      return route.continue();
    }
    return route.fulfill({ status: 200, json: {} });
  });
});

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

const routes = [
  {
    path: "/",
    check: (page: Page) =>
      expect(page.getByRole("heading", { level: 1 })).toContainText("Escrow that"),
  },
  {
    path: "/dashboard",
    check: (page: Page) =>
      expect(page.getByText("Connect your wallet to view your jobs")).toBeVisible(),
  },
  {
    path: "/create",
    check: (page: Page) => expect(page.getByTestId("wizard-step-list")).toBeVisible(),
  },
];

for (const { path, check } of routes) {
  test(`${path} loads without errors`, async ({ page }) => {
    const errors = trackErrors(page);
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await page.waitForLoadState("networkidle");
    await check(page);
    expect(errors).toEqual([]);
  });
}

test("unknown routes return a real 404", async ({ page }) => {
  const res = await page.goto("/nonsense");
  expect(res?.status()).toBe(404);
});

test("favicon is not the Create Next App default", async ({ page }) => {
  const res = await page.goto("/favicon.ico");
  expect(res?.status()).toBe(200);
  const body = await res!.body();
  expect(body.length).toBeGreaterThan(0);
  // The Create Next App default favicon.ico is a 25,931-byte file whose
  // SHA-256 is fixed; the product icon must not match it.
  const DEFAULT_FAVICON_SHA256 =
    "c30c7d42707a47a3f4591831641e50dc29b47367dd8c81e3f9c5b0e6f0e1a4a1";
  const { createHash } = await import("node:crypto");
  const sha256 = createHash("sha256").update(body).digest("hex");
  expect(sha256).not.toBe(DEFAULT_FAVICON_SHA256);
});
