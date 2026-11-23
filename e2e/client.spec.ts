import { test, expect } from "@playwright/test";
import { ADDRESSES, TOKEN_ADDRESS } from "./fixtures";
import { installFakeWallet, stubBackend, trackErrors } from "./helpers";

test.describe("client", () => {
  test("creates and funds a job through the UI, asserting initialize arguments", async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await installFakeWallet(page, "client");
    const backend = await stubBackend(page);

    await page.goto("/create");
    await expect(page.getByTestId("create-job-form")).toBeVisible();

    await page.getByLabel("Freelancer Address").fill(ADDRESSES.freelancer);
    await page.getByLabel("Arbiter Address").fill(ADDRESSES.arbiter);
    await page.locator("#token-manual").fill(TOKEN_ADDRESS);
    await page
      .getByRole("textbox", { name: "Milestone 1 amount in stroops" })
      .fill("100000000");

    await page.getByRole("button", { name: "Create Job" }).click();

    await expect.poll(() => backend.buildTxCalls.length).toBe(1);
    const call = backend.buildTxCalls[0];
    expect(call.method).toBe("initialize");
    expect(typeof call.contractId).toBe("string");
    expect(call.sourceAddress).toBe(ADDRESSES.client);
    expect(call.args).toEqual([
      { type: "address", value: ADDRESSES.client },
      { type: "address", value: ADDRESSES.client },
      { type: "address", value: ADDRESSES.freelancer },
      { type: "address", value: ADDRESSES.arbiter },
      { type: "address", value: TOKEN_ADDRESS },
      { type: "u64", value: "604800" },
      {
        type: "vec",
        value: [{ type: "i128", value: "100000000" }],
      },
    ]);
    await expect.poll(() => backend.submitCalls.length).toBe(1);

    // The stubbed backend advances the newly created job to "funded".
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByTestId("dashboard-list-item").first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("approves a delivered milestone and partially releases funds", async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await installFakeWallet(page, "client");
    const backend = await stubBackend(page, {
      jobs: [
        {
          id: "job-e2e-000000000002",
          client: ADDRESSES.client,
          freelancer: ADDRESSES.freelancer,
          arbiter: ADDRESSES.arbiter,
          funded: true,
          tokenSymbol: "USDC",
          tokenDecimals: 7,
          milestones: [{ index: 0, amount: "100000000", status: "Delivered" }],
        },
      ],
    });

    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-expanded-panel")).toBeVisible();

    await page.getByRole("button", { name: "Approve Milestone 1" }).click();
    await expect(page.getByText(/wired to contract soon/)).toBeVisible();

    await page.getByTestId("partial-amount-input").fill("40000000");
    await page.getByTestId("partial-release-btn").click();

    await expect.poll(() => backend.buildTxCalls.length).toBe(1);
    const call = backend.buildTxCalls[0];
    expect(call.method).toBe("approve_partial");
    expect(call.sourceAddress).toBe(ADDRESSES.client);
    expect(call.args).toEqual([
      { type: "address", value: ADDRESSES.client },
      { type: "u32", value: "0" },
      { type: "i128", value: "40000000" },
    ]);
    await expect.poll(() => backend.submitCalls.length).toBe(1);
    expect(errors).toEqual([]);
  });
});
