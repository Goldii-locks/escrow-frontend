import { test, expect } from "@playwright/test";
import { ADDRESSES, makeJob } from "./fixtures";
import { installFakeWallet, stubBackend, trackErrors } from "./helpers";

test("freelancer delivers a milestone and claims auto-release", async ({ page }) => {
  const errors = trackErrors(page);
  await installFakeWallet(page, "freelancer");
  const backend = await stubBackend(page, {
    jobs: [
      makeJob({
        freelancer: ADDRESSES.freelancer,
        milestones: [{ index: 0, amount: "100000000", status: "Pending" }],
      }),
    ],
  });

  await page.goto("/dashboard");
  await expect(page.getByTestId("dashboard-expanded-panel")).toBeVisible();

  // "Mark Delivered" is still a UI confirmation in this checkout: it must at
  // least be reachable and acknowledge the action without a wallet prompt.
  await page.getByRole("button", { name: "Mark Milestone 1 as delivered" }).click();
  await expect(page.getByText(/wired to contract soon/)).toBeVisible();

  // The stubbed backend now reports the delivered milestone as eligible.
  backend.jobs[0].milestones[0].status = "Delivered";
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Claim auto-release for Milestone 1" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Claim auto-release for Milestone 1" }).click();

  await expect.poll(() => backend.buildTxCalls.length).toBe(1);
  const call = backend.buildTxCalls[0];
  expect(call.method).toBe("claim_auto_release");
  expect(call.sourceAddress).toBe(ADDRESSES.freelancer);
  expect(call.args).toEqual([
    { type: "address", value: ADDRESSES.freelancer },
    { type: "u32", value: "0" },
  ]);
  await expect.poll(() => backend.submitCalls.length).toBe(1);
  expect(errors).toEqual([]);
});
