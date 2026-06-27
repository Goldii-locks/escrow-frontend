import { formatTxError, WalletRejectedError } from "@/app/lib/errors";

export type ContractArg = { type: string; value: unknown };

export type TxPhase = "idle" | "building" | "signing" | "submitting" | "success" | "error";

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || "";

export function getPhaseLabel(phase: TxPhase): string {
  switch (phase) {
    case "building":
      return "Preparing...";
    case "signing":
      return "Sign in wallet...";
    case "submitting":
      return "Submitting...";
    default:
      return "";
  }
}

export function isTxPending(phase: TxPhase): boolean {
  return phase === "building" || phase === "signing" || phase === "submitting";
}

async function parseErrorResponse(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return body.error || body.message || fallback;
  } catch {
    return fallback;
  }
}

export async function submitContractTransaction({
  method,
  args,
  sourceAddress,
  signTransaction,
  onPhase,
}: {
  method: string;
  args: ContractArg[];
  sourceAddress: string;
  signTransaction: (xdr: string) => Promise<string>;
  onPhase?: (phase: TxPhase) => void;
}): Promise<string> {
  onPhase?.("building");

  const buildTxRes = await fetch(`${BACKEND_URL}/api/jobs/build-tx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contractId: CONTRACT_ID,
      method,
      args,
      sourceAddress,
    }),
  });

  if (!buildTxRes.ok) {
    const message = await parseErrorResponse(
      buildTxRes,
      "We could not prepare your transaction. Please try again."
    );
    throw new Error(message);
  }

  const { xdr } = await buildTxRes.json();

  onPhase?.("signing");

  let signedXdr: string;
  try {
    signedXdr = await signTransaction(xdr);
  } catch {
    throw new WalletRejectedError();
  }

  if (!signedXdr) {
    throw new WalletRejectedError();
  }

  onPhase?.("submitting");

  const submitRes = await fetch(`${BACKEND_URL}/api/jobs/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signedXdr }),
  });

  if (!submitRes.ok) {
    const message = await parseErrorResponse(
      submitRes,
      "Your transaction could not be submitted. Please try again."
    );
    throw new Error(message);
  }

  const result = await submitRes.json();
  return result.hash || result.txHash || result.transactionHash || "";
}

export async function runContractAction(
  key: string,
  txFn: (onPhase: (phase: TxPhase) => void) => Promise<string>,
  handlers: {
    isPending: (key: string) => boolean;
    setPhase: (key: string, phase: TxPhase) => void;
    setError: (key: string, error: string | null) => void;
    setTxHash: (key: string, txHash: string | null) => void;
  }
): Promise<string | null> {
  if (handlers.isPending(key)) return null;

  handlers.setPhase(key, "building");
  handlers.setError(key, null);
  handlers.setTxHash(key, null);

  try {
    const txHash = await txFn((phase) => handlers.setPhase(key, phase));
    handlers.setPhase(key, "success");
    handlers.setTxHash(key, txHash || null);
    return txHash;
  } catch (err) {
    handlers.setPhase(key, "error");
    handlers.setError(key, formatTxError(err));
    return null;
  }
}
