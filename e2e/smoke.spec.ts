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

/** Collect CSP violation reports emitted by the browser. */
function trackCspViolations(page: Page) {
  const violations: string[] = [];
  page.on("console", (msg) => {
    // Chromium surfaces CSP violations as console errors with this prefix.
    if (msg.type() === "error" && msg.text().includes("Content Security Policy")) {
      violations.push(msg.text());
    }
  });
  // securitypolicyviolation fires on the page when a CSP directive is violated.
  page.on("pageerror", (err) => {
    if (err.message.includes("Content Security Policy")) {
      violations.push(err.message);
    }
  });
  return violations;
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

// ---------------------------------------------------------------------------
// CSP enforcement checks (#890)
// ---------------------------------------------------------------------------

test("enforcing Content-Security-Policy header is present (not report-only)", async ({ page }) => {
  const res = await page.goto("/");
  expect(res).not.toBeNull();

  const cspEnforcing = res!.headers()["content-security-policy"];
  const cspReportOnly = res!.headers()["content-security-policy-report-only"];

  // The enforcing header must exist.
  expect(cspEnforcing, "Content-Security-Policy header missing").toBeTruthy();

  // The report-only header must NOT exist (the policy is enforced, not observed).
  expect(
    cspReportOnly,
    "Content-Security-Policy-Report-Only must be absent when enforcing"
  ).toBeFalsy();

  // script-src must not allow 'unsafe-inline' (style-src still does, for
  // Tailwind/Next inline styles); inline scripts are allowed by hash instead.
  const scriptSrc =
    cspEnforcing!
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("script-src ")) ?? "";
  expect(scriptSrc, "script-src directive missing").not.toBe("");
  expect(scriptSrc).not.toContain("'unsafe-inline'");

  // script-src must have at least one SHA-256 hash (the inline scripts allowlist).
  expect(scriptSrc).toContain("'sha256-");
});

for (const { path, check } of routes) {
  test(`${path} has no CSP violations under enforcing policy`, async ({ page }) => {
    const violations = trackCspViolations(page);
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await page.waitForLoadState("networkidle");

    // Confirm the page actually hydrated (not just the shell).
    await check(page);

    expect(violations, `CSP violations on ${path}: ${violations.join("; ")}`).toHaveLength(0);
  });
}

test("/nonsense shows the branded 404 page", async ({ page }) => {
  await page.goto("/nonsense");
  await page.waitForLoadState("networkidle");
  // Branded heading and copy
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Page not found");
  await expect(page.getByText("404")).toBeVisible();
  // Navigation links
  await expect(page.getByRole("link", { name: "Go to dashboard" })).toHaveAttribute(
    "href",
    "/dashboard"
  );
  await expect(page.getByRole("link", { name: "Go to home" })).toHaveAttribute("href", "/");
});
