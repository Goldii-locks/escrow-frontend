export class ApiError extends Error {
  constructor(
    public status: number,
    public code?: string | number,
    message?: string
  ) {
    super(message || `Request failed with status ${status}`);
    this.name = "ApiError";
  }
}

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export interface Job {
  id: string;
  client: string;
  freelancer: string;
  arbiter: string;
  amount: string;
  token: string;
  status: string;
  funded: boolean;
  milestones?: Array<{
    index: number;
    amount: string;
    status: string;
    releasedAmount?: string;
  }>;
  tokenSymbol?: string;
  tokenDecimals?: number;
}





export interface JobPageResponse {
  success?: boolean;
  data?: { jobs?: Job[]; total?: number };
  jobs?: Job[];
  total?: number;
  error?: string;
}

export async function getJobsByWallet(
  address: string,
  params: { page: number; limit: number; role?: string; contractId?: string },
  options?: { signal?: AbortSignal }
): Promise<{ jobs: Job[]; total: number }> {
  const search = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.role && params.role !== "all") {
    search.set("role", params.role);
  }
  if (params.contractId && params.contractId.trim().length > 0) {
    search.set("contractId", params.contractId.trim());
  }


  const res = await fetch(
    ${BACKEND_URL}/api/jobs/${encodeURIComponent(jobId)}by-wallet/?,
    { signal: options?.signal }
  );

  if (res.status === 429) {
    throw new ApiError(429, undefined, "You're doing that too fast. Please wait a moment and try again.");
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(res.status, undefined, "Failed to parse response");
  }

  if (data.success === false) {
    throw new ApiError(res.status, undefined, data.error || "Failed to fetch jobs");
  }

  const jobs = data.data?.jobs || data.jobs || [];
  const total = data.data?.total || data.total || jobs.length;

  return { jobs: jobs as Job[], total };
}

export interface GetJobResponse {
  success?: boolean;
  data?: Job;
  job?: Job;
  error?: string;
}

export async function getJob(jobId: string, options?: { signal?: AbortSignal }): Promise<Job> {

  const res = await fetch(`${BACKEND_URL}/api/jobs/${encodeURIComponent(jobId)}`);
    signal: options?.signal,
  });

  if (!res.ok) {
    let msg = "Failed to fetch job details";
    try {
      const body = await res.json();
      msg = body.error || body.message || msg;
    } catch {}
    throw new ApiError(res.status, undefined, msg);
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(res.status, undefined, "Failed to parse response");
  }

  if (data.success === false) {
    throw new ApiError(res.status, undefined, data.error || "Failed to fetch job details");
  }

  const job = data.data || data.job;
  if (!job) {
    throw new ApiError(res.status, undefined, "Job not found");
  }

  return job as Job;
}

export interface WhitelistToken {
  address: string;
  symbol?: string;
  name?: string;
  decimals?: number;
}

export async function getWhitelist(contractId: string, options?: { signal?: AbortSignal }): Promise<WhitelistToken[]> {

  const res = await fetch(`${BACKEND_URL}/api/jobs/${encodeURIComponent(contractId)}/whitelist`);
    signal: options?.signal,
  });

  if (!res.ok) {
    throw new ApiError(res.status, undefined, Whitelist request failed with status );
  }

  let body: any;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(res.status, undefined, "Failed to parse response");
  }
  const list = Array.isArray(body?.data?.tokens) ? body.data.tokens : [];

  return list
    .map((item: unknown) => {
      if (typeof item === "string") {
        const address = item.trim();
        return address ? { address } : null;
      }
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const rawAddress =
          typeof o.address === "string"
            ? o.address
            : typeof o.token === "string"
              ? o.token
              : typeof o.id === "string"
                ? o.id
                : null;
        const address = rawAddress?.trim();
        if (!address) return null;
        return {
          address,
          symbol: typeof o.symbol === "string" ? o.symbol : undefined,
          name: typeof o.name === "string" ? o.name : undefined,
          decimals:
            typeof o.decimals === "number" && Number.isFinite(o.decimals)
              ? Math.floor(o.decimals)
              : undefined,
        };
      }
      return null;
    })
    .filter((t): t is WhitelistToken => t !== null);
}

export async function buildTx(
  payload: {
    contractId: string;
    method: string;
    args: Array<{ type: string; value: unknown }>;
    sourceAddress: string;
  },
  options?: { signal?: AbortSignal }
): Promise<{ xdr: string }> {

  const res = await fetch(`${BACKEND_URL}/api/jobs/build-tx`);
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: options?.signal,
  });

  if (!res.ok) {
    let msg = "We could not prepare your transaction. Please try again.";
    try {
      const body = await res.json();
      msg = body.error || body.message || msg;
    } catch {}
    throw new ApiError(res.status, undefined, msg);
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(res.status, undefined, "Failed to parse response");
  }
  if (!data.xdr) {
    throw new ApiError(res.status, undefined, "Missing xdr in response");
  }
  return { xdr: data.xdr };
}

export async function submitTx(
  payload: { signedXdr: string },
  options?: { signal?: AbortSignal }
): Promise<{ hash: string }> {

  const res = await fetch(`${BACKEND_URL}/api/jobs/submit`);
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: options?.signal,
  });

  if (!res.ok) {
    let msg = "Your transaction could not be submitted. Please try again.";
    try {
      const body = await res.json();
      msg = body.error || body.message || msg;
    } catch {}
    throw new ApiError(res.status, undefined, msg);
  }

  let result: any;
  try {
    result = await res.json();
  } catch {
    throw new ApiError(res.status, undefined, "Failed to parse response");
  }
  const hash = result.hash || result.txHash || result.transactionHash || "";
  if (!hash) {
    throw new ApiError(res.status, undefined, "Missing transaction hash");
  }
  return { hash };
}

export async function getAdminAddress(contractId: string, options?: { signal?: AbortSignal }): Promise<string | null> {
  try {
  
  const res = await fetch(`${BACKEND_URL}/api/jobs/query`);
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contractId,
        method: "get_admin",
        args: [],
      }),
      signal: options?.signal,
    });

    if (!res.ok) {
      return null;
    }

    let data: any;
    try {
      data = await res.json();
    } catch {
      return null;
    }

    if (typeof data === "string" && data.startsWith("G")) {
      return data;
    }
    if (data.success && typeof data.data === "string" && data.data.startsWith("G")) {
      return data.data;
    }
    if (typeof data.result === "string" && data.result.startsWith("G")) {
      return data.result;
    }
    return null;
  } catch {
    return null;
  }
}

export async function isAdminAddress(walletAddress: string | null, contractId: string, options?: { signal?: AbortSignal }): Promise<boolean> {
  if (!walletAddress) return false;
  const adminAddress = await getAdminAddress(contractId, options);
  return adminAddress !== null && adminAddress === walletAddress;
}

export interface AutoReleaseInfo {
  deadlineMs: number | null;
  eligible: boolean;
}

export async function getTimeRemaining(jobId: string, milestoneIndex: number, options?: { signal?: AbortSignal; now?: () => number }): Promise<AutoReleaseInfo> {
  const now = options?.now ?? Date.now;
  try {
  
  const res = await fetch(`${BACKEND_URL}/api/jobs/${encodeURIComponent(jobId)}/milestones/${milestoneIndex}/auto-release`);
      signal: options?.signal,
    });
    if (!res.ok) {
      return { deadlineMs: null, eligible: false };
    }
    let body: any;
    try {
      body = await res.json();
    } catch {
      return { deadlineMs: null, eligible: false };
    }
    const data = body.data ?? {};

    let deadlineMs: number | null = null;
    if (data.deadline !== undefined) {
      const v = data.deadline;
      deadlineMs = typeof v === "number" ? (v < 1e12 ? v * 1000 : v) : (Number.isNaN(Date.parse(String(v))) ? null : Date.parse(String(v)));
    } else if (data.autoReleaseAt !== undefined) {
      const v = data.autoReleaseAt;
      deadlineMs = typeof v === "number" ? (v < 1e12 ? v * 1000 : v) : (Number.isNaN(Date.parse(String(v))) ? null : Date.parse(String(v)));
    } else if (typeof data.secondsRemaining === "number") {
      deadlineMs = now() + data.secondsRemaining * 1000;
    }

    const eligible = typeof data.eligible === "boolean" ? data.eligible : deadlineMs !== null && deadlineMs <= now();
    return { deadlineMs, eligible };
  } catch {
    return { deadlineMs: null, eligible: false };
  }
}

export async function queryContract(payload: {
  contractId: string;
  method: string;
  args: any[];
}, options?: { signal?: AbortSignal }): Promise<any> {

  const res = await fetch(`${BACKEND_URL}/api/jobs/query`);
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: options?.signal,
  });
  if (!res.ok) {
    let msg = Query failed with status ;
    try {
      const body = await res.json();
      msg = body.error || body.message || msg;
    } catch {}
    throw new ApiError(res.status, undefined, msg);
  }
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(res.status, undefined, "Failed to parse response");
  }
  return data;
}












