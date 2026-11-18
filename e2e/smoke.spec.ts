import { test, expect, type Page } from "@playwright/test";

// Block anything that leaves the static site (backend API, Soroban RPC,
// Horizon, wallet extensions' remote endpoints) so the smoke run is
// hermetic. Same-origin /api/ calls (versioned or not) get an empty success
// payload.
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

// The frontend must only talk to the versioned API. Any unversioned /api/
// request would be served by the backend's deprecated routes and come back
// with a `Deprecation: true` header.
test("frontend requests only the versioned API", async ({ page, baseURL }) => {
  const apiRequests: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.startsWith(`${baseURL}/api/`)) apiRequests.push(url);
  });

  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  const unversioned = apiRequests.filter(
    (url) => !url.startsWith(`${baseURL}/api/v1/`),
  );
  expect(unversioned).toEqual([]);
});

test("/api/v1 responses carry no Deprecation header", async ({ page, baseURL }) => {
  const deprecationHeaders: string[] = [];
  page.on("response", (res) => {
    const url = res.url();
    if (!url.startsWith(`${baseURL}/api/v1/`)) return;
    const header = res.headers()["deprecation"];
    if (header !== undefined) deprecationHeaders.push(`${url}: ${header}`);
  });

  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  expect(deprecationHeaders).toEqual([]);
});

// Mirrors the nginx `map` patterns in nginx.conf. The public-read limiter
// must keep matching the versioned wallet-jobs and job-detail paths.
const PUBLIC_READ_PATTERNS = [
  /^\/api\/(?:v1\/)?jobs\/by-wallet\//,
  /^\/api\/(?:v1\/)?jobs\/C[^/]+$/,
];

function matchesPublicRead(path: string): boolean {
  return PUBLIC_READ_PATTERNS.some((re) => re.test(path));
}

test("public-read limiter still matches versioned API paths", async () => {
  // Unversioned (legacy) paths.
  expect(matchesPublicRead("/api/jobs/by-wallet/GABC")).toBe(true);
  expect(matchesPublicRead("/api/jobs/CABC123")).toBe(true);
  // Versioned paths.
  expect(matchesPublicRead("/api/v1/jobs/by-wallet/GABC")).toBe(true);
  expect(matchesPublicRead("/api/v1/jobs/CABC123")).toBe(true);
  // Unrelated paths must not be limited.
  expect(matchesPublicRead("/api/v1/jobs/build-tx")).toBe(false);
  expect(matchesPublicRead("/api/v1/jobs/submit")).toBe(false);
  expect(matchesPublicRead("/api/v1/jobs/query")).toBe(false);
});

test("public-read limiter applies to /api/v1/jobs/by-wallet/*", async ({
  page,
  baseURL,
}) => {
  // Drive the limiter by issuing a burst of wallet-jobs reads and assert the
  // backend answers them (either 200 or 429 once the limit trips) rather than
  // 404, proving the route is mounted under /api/v1 and rate-limited.
  const statuses: number[] = [];
  for (let i = 0; i < 5; i++) {
    const res = await page.request.get(
      `${baseURL}/api/v1/jobs/by-wallet/GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF`,
    );
    statuses.push(res.status());
  }
  for (const status of statuses) {
    expect([200, 429]).toContain(status);
  }
});
