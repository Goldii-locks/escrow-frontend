/**
 * testnet_onboarding.ts — Helpers for the testnet "Get set up" onboarding panel.
 *
 * All runtime logic lives here so the component stays thin and the functions
 * are unit-testable without a DOM.
 *
 * None of these helpers are called on mainnet builds: the component guards
 * every entry point with `isTestnet()`.
 */
import { NETWORK_PASSPHRASE, createRpcServer } from "@/app/lib/config";
import { NETWORK_PASSPHRASES } from "@/app/lib/network_config";
import { apiGet, ApiHttpError } from "@/app/lib/api";
import { z } from "zod";

/** True when the app is built against Stellar testnet. */
export function isTestnet(): boolean {
  return NETWORK_PASSPHRASE === NETWORK_PASSPHRASES.TESTNET;
}

/** Friendbot endpoint used to fund brand-new testnet accounts. */
export const FRIENDBOT_URL = "https://friendbot.stellar.org";

/**
 * Ask Friendbot to fund `address` with 10 000 XLM.
 * Resolves when the funding transaction is accepted; throws on failure.
 */
export async function fundWithFriendbot(address: string): Promise<void> {
  const url = `${FRIENDBOT_URL}?addr=${encodeURIComponent(address)}`;
  try {
    await apiGet(url, z.unknown(), { envelope: "none" });
  } catch (error) {
    if (!(error instanceof ApiHttpError)) throw error;
    let detail = "";
    const body = error.payload as {
      detail?: string;
      extras?: { result_codes?: unknown };
    } | undefined;
    if (body) {
      detail = body.detail ?? JSON.stringify(body.extras?.result_codes ?? "");
    }
    throw new Error(
      `Friendbot returned HTTP ${error.status}${detail ? `: ${detail}` : ""}. Try again in a moment.`
    );
  }
}

export interface AccountStatus {
  /** Account does not exist on-chain (needs Friendbot). */
  notFound: boolean;
  /**
   * Account exists but has no balance entry for the given token.
   * Only relevant when `notFound` is false.
   */
  missingTrustline: boolean;
  /**
   * Account has a trustline but the token balance is zero.
   * Only relevant when neither `notFound` nor `missingTrustline` is true.
   */
  zeroBalance: boolean;
}

/** Returned when we can't determine status — the panel hides rather than showing stale state. */
const NO_ISSUES: AccountStatus = {
  notFound: false,
  missingTrustline: false,
  zeroBalance: false,
};

/**
 * Check the account's on-chain state relative to `tokenAddress` by simulating
 * the SEP-41 `balance(address)` call via the Soroban RPC.
 *
 * - A simulation error (host function trap / no contract state) → `missingTrustline`.
 * - A zero result → `zeroBalance`.
 * - Any unexpected error → `NO_ISSUES` so the panel doesn't appear incorrectly.
 *
 * Account existence is checked first via Horizon because it is a cheap HTTP
 * call and avoids an RPC round-trip for the most common new-user case.
 */
export async function fetchAccountStatus(
  address: string,
  tokenAddress: string
): Promise<AccountStatus> {
  if (!address) return NO_ISSUES;

  // ── 1. Does the account exist? ────────────────────────────────────────────
  try {
    await apiGet(
      `https://horizon-testnet.stellar.org/accounts/${encodeURIComponent(address)}`,
      z.unknown(),
      { envelope: "none" }
    );
  } catch (error) {
    if (error instanceof ApiHttpError && error.status === 404) {
      return { notFound: true, missingTrustline: false, zeroBalance: false };
    }
    // Any other non-OK status: continue to the RPC check below.
  }

  // Skip trustline check when no token address is supplied.
  if (!tokenAddress) return NO_ISSUES;

  // ── 2. Does a balance entry exist for the token? ──────────────────────────
  try {
    const [
      { Account, Contract, Keypair, TransactionBuilder, nativeToScVal, scValToNative },
      { Api },
      server,
    ] = await Promise.all([
      import("@stellar/stellar-sdk"),
      import("@stellar/stellar-sdk/rpc"),
      createRpcServer(),
    ]);

    // Use a random keypair as source: balance() is read-only so the account
    // doesn't need to exist and no fee is charged.
    const probeAccount = new Account(Keypair.random().publicKey(), "0");
    const tx = new TransactionBuilder(probeAccount, {
      fee: "100",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        new Contract(tokenAddress).call("balance", nativeToScVal(address, { type: "address" }))
      )
      .setTimeout(30)
      .build();

    const response = await server.simulateTransaction(tx);

    if (Api.isSimulationError(response)) {
      // A host-function trap on `balance()` means no trustline / balance entry.
      return { notFound: false, missingTrustline: true, zeroBalance: false };
    }

    if (!response.result) return NO_ISSUES;

    // scValToNative returns a bigint for i128 values in modern SDK builds,
    // but may return a number or string in older ones. Convert defensively.
    const raw: unknown = scValToNative(response.result.retval);
    let balance: bigint;
    if (typeof raw === "bigint") {
      balance = raw;
    } else if (typeof raw === "number") {
      balance = BigInt(Math.trunc(raw));
    } else {
      balance = BigInt(String(raw));
    }

    return {
      notFound: false,
      missingTrustline: false,
      zeroBalance: balance === BigInt(0),
    };
  } catch {
    return NO_ISSUES;
  }
}

// ---------------------------------------------------------------------------
// XDR asset decoding helpers for buildChangeTrustXdr
// ---------------------------------------------------------------------------

/**
 * Low-level helper: decode the code and issuer from an XDR AssetCreditAlphanum4
 * or AssetCreditAlphanum12 object returned by `Asset.toXDRObject()`.
 *
 * The XDR object's internal structure is:
 *   { alphaNum4: { assetCode: { value: Uint8Array }, issuer: { ed25519: { value: Uint8Array } } } }
 *   { alphaNum12: same shape }
 *
 * We use `unknown` casts because the generated TypeScript typings don't expose
 * these internal property names, but the runtime objects reliably carry them.
 */
function decodeXdrAsset(
  xdrObj: unknown,
  StrKey: { encodeEd25519PublicKey: (buf: Uint8Array) => string }
): { code: string; issuer: string } | null {
  const obj = xdrObj as Record<string, Record<string, unknown> | undefined>;

  const inner =
    (obj["alphaNum4"] as Record<string, unknown> | undefined) ??
    (obj["alphaNum12"] as Record<string, unknown> | undefined);

  if (!inner) return null; // native asset — no trustline needed

  const codeContainer = inner["assetCode"] as { value?: Uint8Array } | undefined;
  const issuerContainer = inner["issuer"] as { ed25519?: { value?: Uint8Array } } | undefined;

  const codeBytes = codeContainer?.value;
  const issuerBytes = issuerContainer?.ed25519?.value;

  if (!codeBytes || !issuerBytes) return null;

  const code = Buffer.from(codeBytes).toString("ascii").replace(/\0/g, "").trim();
  const issuer = StrKey.encodeEd25519PublicKey(issuerBytes);

  return { code, issuer };
}

/**
 * Build an unsigned `changeTrust` XDR to establish a classic trustline for
 * the Stellar Asset Contract at `tokenContractId`.
 *
 * The SAC exposes an `asset()` Soroban function that returns an XDR `Asset`
 * ScVal. We simulate that call to retrieve the asset, decode the code and
 * issuer from the XDR object, then build a classic `changeTrust` operation
 * on behalf of `address`.
 *
 * Returns the base64-encoded XDR string ready to pass to `signTransaction`.
 * Throws when the token is not a SAC (custom Soroban tokens have no
 * classic-asset trustline concept).
 */
export async function buildChangeTrustXdr(
  address: string,
  tokenContractId: string
): Promise<string> {
  const [
    { Account, Asset, Contract, Keypair, Operation, TransactionBuilder, scValToNative, StrKey },
    { Api },
    server,
  ] = await Promise.all([
    import("@stellar/stellar-sdk"),
    import("@stellar/stellar-sdk/rpc"),
    createRpcServer(),
  ]);

  // ── Step 1: Simulate the SAC `asset()` function ───────────────────────────
  const probeAccount = new Account(Keypair.random().publicKey(), "0");
  const probeTx = new TransactionBuilder(probeAccount, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(new Contract(tokenContractId).call("asset"))
    .setTimeout(30)
    .build();

  const probeResponse = await server.simulateTransaction(probeTx);

  if (Api.isSimulationError(probeResponse)) {
    throw new Error(
      "This token does not appear to be a Stellar Asset Contract (SAC). " +
        "No classic Stellar trustline is required for custom Soroban tokens."
    );
  }

  if (!probeResponse.result) {
    throw new Error("Could not retrieve the underlying asset from this token contract.");
  }

  // ── Step 2: Decode the returned XDR Asset ─────────────────────────────────
  // scValToNative on an XDR Asset ScVal returns the XDR object produced by
  // Asset.toXDRObject() — an AssetNative, AssetCreditAlphanum4, or
  // AssetCreditAlphanum12 instance. We decode code + issuer from its shape.
  const retval = probeResponse.result.retval;
  const nativeDecoded: unknown = scValToNative(retval);

  // `scValToNative` may return a Buffer (for SCV_BYTES), in which case the
  // SAC `asset()` returned raw XDR bytes. Decode via xdr.Asset.
  let classicAsset: InstanceType<typeof Asset>;
  if (Buffer.isBuffer(nativeDecoded) || nativeDecoded instanceof Uint8Array) {
    // Raw XDR bytes: decode into an Asset via the XDR type's toXDR/fromXDR.
    // We already have the bytes from toXDR(); rebuild by re-encoding with
    // StrKey — the byte layout is: 4-byte type, then code/issuer.
    const buf = Buffer.from(nativeDecoded);
    const type = buf.readUInt32BE(0);
    if (type === 0) {
      // Native
      classicAsset = Asset.native();
    } else if (type === 1) {
      // alphanum4: 4 bytes code (padded), then 36 bytes issuer (4 type + 32 key)
      const code = buf.slice(4, 8).toString("ascii").replace(/\0/g, "").trim();
      const issuerBytes = buf.slice(12, 44); // skip 4 type bytes of PublicKey
      const issuer = StrKey.encodeEd25519PublicKey(issuerBytes);
      classicAsset = new Asset(code, issuer);
    } else if (type === 2) {
      // alphanum12: 12 bytes code (padded), then 36 bytes issuer
      const code = buf.slice(4, 16).toString("ascii").replace(/\0/g, "").trim();
      const issuerBytes = buf.slice(20, 52);
      const issuer = StrKey.encodeEd25519PublicKey(issuerBytes);
      classicAsset = new Asset(code, issuer);
    } else {
      throw new Error(`Unknown XDR asset type ${type}.`);
    }
  } else {
    // scValToNative returned an XDR object. Decode code/issuer from its shape.
    const decoded = decodeXdrAsset(nativeDecoded, StrKey);
    if (!decoded) {
      // Native asset — no trustline is ever needed.
      throw new Error("This token wraps the native XLM asset; no trustline is required.");
    }
    classicAsset = new Asset(decoded.code, decoded.issuer);
  }

  // ── Step 3: Build the changeTrust transaction ─────────────────────────────
  const accountData = await server.getAccount(address);
  const account = new Account(address, accountData.sequenceNumber());

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.changeTrust({
        asset: classicAsset,
        // No explicit limit → maximum trustline limit.
      })
    )
    .setTimeout(300)
    .build();

  return tx.toXDR();
}
