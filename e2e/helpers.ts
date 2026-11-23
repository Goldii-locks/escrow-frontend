import type { Page, Route } from "@playwright/test";
import {
  ADDRESSES,
  CONTRACT_ID,
  JOB_ID,
  NETWORK_PASSPHRASE,
  TOKEN_ADDRESS,
  TX_HASH,
  UNSIGNED_XDR,
  makeJob,
  type E2EJob,
} from "./fixtures";

export interface BuildTxCall {
  contractId: string;
  method: string;
  args: Array<{ type: string; value: unknown }>;
  sourceAddress: string;
}

export interface BackendState {
  jobs: E2EJob[];
  buildTxCalls: BuildTxCall[];
  submitCalls: Array<{ signedXdr: string }>;
}

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

/**
 * Seeds a connected Freighter session and answers the wallet bridge's
 * postMessage protocol. `signTransaction` returns the XDR unchanged, as the
 * issue requires; no extension is installed in the browser.
 */
export async function installFakeWallet(
  page: Page,
  role: keyof typeof ADDRESSES = "client",
): Promise<string> {
  const address = ADDRESSES[role];
  await page.addInitScript(
    ({ address: walletAddress, passphrase }) => {
      // freighter-api short-circuits isConnected() when this flag is present.
      (window as unknown as Record<string, unknown>)["freighter"] = true;

      const now = Date.now();
      window.localStorage.setItem(
        "wallet_state_store_active_state",
        JSON.stringify({
          version: 1,
          address: walletAddress,
          selectedWalletId: "freighter",
          networkPassphrase: passphrase,
          connectedAt: now,
        }),
      );
      window.localStorage.setItem(
        "freighter_connector_active_address",
        JSON.stringify({
          version: 1,
          address: walletAddress,
          network: passphrase,
          connectedAt: now,
        }),
      );

      window.addEventListener("message", (event: MessageEvent) => {
        if (event.source !== window) return;
        const request = event.data as
          | { source?: string; messageId?: number; type?: string; transactionXdr?: string }
          | null;
        if (request?.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST") return;

        // The wallet bridge deliberately uses `messagedId` (sic) in responses.
        const reply: Record<string, unknown> = {
          source: "FREIGHTER_EXTERNAL_MSG_RESPONSE",
          messagedId: request.messageId,
        };
        switch (request.type) {
          case "REQUEST_PUBLIC_KEY":
          case "REQUEST_ACCESS":
            reply.publicKey = walletAddress;
            break;
          case "REQUEST_CONNECTION_STATUS":
            reply.isConnected = true;
            break;
          case "REQUEST_NETWORK_DETAILS":
            reply.networkDetails = {
              network: "testnet",
              networkName: "testnet",
              networkUrl: "https://soroban-testnet.stellar.org",
              networkPassphrase: passphrase,
            };
            break;
          case "SUBMIT_TRANSACTION":
            reply.signedTransaction = request.transactionXdr;
            reply.signerAddress = walletAddress;
            break;
          default:
            break;
        }
        window.postMessage(reply, window.location.origin);
      });
    },
    { address, passphrase: NETWORK_PASSPHRASE },
  );

  // The create page confirms with window.alert() after a successful submit.
  page.on("dialog", (dialog) => dialog.accept());
  return address;
}

/** Stubs every backend call the app makes, recording transaction arguments. */
export async function stubBackend(
  page: Page,
  initial: { jobs: E2EJob[] } = { jobs: [] },
): Promise<BackendState> {
  const state: BackendState = {
    jobs: initial.jobs.map((job) => structuredClone(job)),
    buildTxCalls: [],
    submitCalls: [],
  };

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, headers: CORS_HEADERS, json: body });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS_HEADERS, body: "" });
      return;
    }

    if (path.endsWith("/api/jobs/build-tx") && method === "POST") {
      const body = JSON.parse(request.postData() ?? "{}") as BuildTxCall;
      state.buildTxCalls.push(body);

      // Initialization creates a funded job so the following dashboard
      // navigation observes the state the backend would have persisted.
      if (body.method === "initialize") {
        const arg = (index: number) => String(body.args[index]?.value ?? "");
        const milestoneArgs = (body.args[6]?.value ?? []) as Array<{ value: string }>;
        state.jobs.push(
          makeJob({
            id: JOB_ID,
            client: arg(0),
            freelancer: arg(2),
            arbiter: arg(3),
            funded: true,
            milestones: milestoneArgs.map((milestone, index) => ({
              index,
              amount: milestone.value,
              status: "Pending",
            })),
          }),
        );
      }

      await json(route, { xdr: UNSIGNED_XDR });
      return;
    }

    if (path.endsWith("/api/jobs/submit") && method === "POST") {
      const body = JSON.parse(request.postData() ?? "{}") as { signedXdr: string };
      state.submitCalls.push(body);
      await json(route, { hash: TX_HASH });
      return;
    }

    if (path.includes("/api/jobs/by-wallet/")) {
      await json(route, { success: true, data: state.jobs, jobs: state.jobs });
      return;
    }

    if (path.endsWith("/api/jobs/query") && method === "POST") {
      await json(route, { success: true, data: ADDRESSES.arbiter });
      return;
    }

    if (path.includes("/whitelist")) {
      await json(route, {
        success: true,
        data: [{ address: TOKEN_ADDRESS, symbol: "USDC", decimals: 7 }],
        tokens: [{ address: TOKEN_ADDRESS, symbol: "USDC", decimals: 7 }],
      });
      return;
    }

    if (path.includes("/auto-release")) {
      await json(route, {
        success: true,
        data: {
          secondsRemaining: 0,
          eligible: true,
          deadline: new Date(Date.now() - 60_000).toISOString(),
        },
      });
      return;
    }

    const match = path.match(/\/api\/jobs\/([^/]+)$/);
    if (match && method === "GET") {
      const job = state.jobs.find((candidate) => candidate.id === match[1]);
      await json(route, { success: true, data: job ?? null });
      return;
    }

    await json(route, { success: true, data: [] });
  });

  return state;
}

/** Navigates to a route with console/page errors collected for assertions. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("favicon")) {
      errors.push(message.text());
    }
  });
  return errors;
}

export const E2E_CONTRACT_ID = CONTRACT_ID;
