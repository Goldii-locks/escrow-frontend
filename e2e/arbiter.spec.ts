import { test, expect } from "@playwright/test";
import { ADDRESSES, makeJob } from "./fixtures";
import { installFakeWallet, stubBackend, trackErrors } from "./helpers";

test("arbiter resolves a dispute, asserting resolve_dispute arguments", async ({
  page,
}) => {
  const errors = trackErrors(page);
  await installFakeWallet(page, "arbiter");
  const backend = await stubBackend(page, {
    jobs: [
      makeJob({
        arbiter: ADDRESSES.arbiter,
        milestones: [{ index: 0, amount: "100000000", status: "Disputed" }],
      }),
    ],
  });

  await page.goto("/dashboard");
  await expect(page.getByTestId("arbiter-action-panel")).toBeVisible();

  await page.getByRole("radio", { name: "Release to Freelancer for Milestone 1" }).check();
  await page.getByLabel("I understand this decision is final.").check();
  await page.getByTestId("arbiter-submit").click();

  await expect.poll(() => backend.buildTxCalls.length).toBe(1);
  const call = backend.buildTxCalls[0];
  expect(call.method).toBe("resolve_dispute");
  expect(call.sourceAddress).toBe(ADDRESSES.arbiter);
  expect(call.args).toEqual([
    { type: "address", value: ADDRESSES.arbiter },
    { type: "u32", value: "0" },
    { type: "bool", value: true },
  ]);
  await expect.poll(() => backend.submitCalls.length).toBe(1);
  expect(errors).toEqual([]);
});
