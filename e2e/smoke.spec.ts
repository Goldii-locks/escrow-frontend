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
