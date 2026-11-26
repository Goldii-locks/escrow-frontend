/**
 * Many dashboard tests mock fetch with a single job-list response. Before
 * #577 the dashboard fell back to that list row when GET /api/jobs/:id
 * failed; it now shows an error instead. This wraps the currently stubbed
 * fetch so /api/jobs/:id answers with the matching job from the list, as
 * the real backend would.
 */
type JsonResponse = { ok?: boolean; status?: number; json: () => Promise<unknown> };

function jobsFrom(body: unknown): Array<{ id?: unknown }> {
  if (typeof body !== "object" || body === null) return [];
  const b = body as { data?: unknown; jobs?: unknown };
  if (Array.isArray(b.data)) return b.data as Array<{ id?: unknown }>;
  if (Array.isArray(b.jobs)) return b.jobs as Array<{ id?: unknown }>;
  const nested = b.data as { jobs?: unknown } | undefined;
  if (nested && Array.isArray(nested.jobs)) return nested.jobs as Array<{ id?: unknown }>;
  return [];
}

function toByWalletEnvelope(raw: unknown, jobs: Array<{ id?: unknown }>): unknown {
  if (typeof raw === "object" && raw !== null && (raw as { success?: unknown }).success === false) {
    return raw;
  }
  const rows = jobs.map((j) => {
    const row = j as Record<string, unknown>;
    const roles = row.roles as unknown[] | undefined;
    const role =
      (row.role as string | undefined) ?? (Array.isArray(roles) ? (roles[0] as string) : undefined);
    const milestones = row.milestones as unknown[] | undefined;
    return {
      contract_id: String(row.id ?? row.contract_id ?? ""),
      role: role ?? "client",
      milestone_count: Array.isArray(milestones) ? milestones.length : 0,
      latest_event_type: "funded",
      latest_ledger: 1,
      latest_timestamp: null,
    };
  });
  const src = (raw as { data?: { total?: number; page?: number; limit?: number } } | null)?.data;
  return {
    success: true,
    data: {
      jobs: rows,
      total: src?.total ?? rows.length,
      page: src?.page ?? 1,
      limit: src?.limit ?? 5,
    },
  };
}

export function wrapFetchWithJobDetails(): void {
  const current = globalThis.fetch as unknown as Record<symbol, unknown>;
  if (current && current[WRAPPED]) return;
  (globalThis as { fetch: unknown }).fetch = wrapFetch(globalThis.fetch);
}

const WRAPPED = Symbol.for("escrow.jobDetailsFetch");

export function wrapFetch(fetchFn: unknown): unknown {
  const inner = fetchFn as (url: string, init?: unknown) => Promise<JsonResponse>;
  let lastList: Array<{ id?: unknown }> = [];
  const wrapped = async (url: string, init?: unknown): Promise<JsonResponse> => {
    const detail = /\/api\/jobs\/([^/?]+)$/.exec(String(url));
    if (detail && !String(url).includes("/by-wallet/")) {
      const id = decodeURIComponent(detail[1]);
      const job = lastList.find((j) => j.id === id);
      if (job) {
        return { ok: true, status: 200, json: async () => ({ success: true, data: job }) };
      }
    }
    const res = await inner(url, init);
    if (!String(url).includes("/by-wallet/")) return res;
    if (!res || typeof res.json !== "function") return res;
    const raw = await res.json();
    const jobs = jobsFrom(raw);
    if (jobs.length > 0) lastList = jobs;
    // The dashboard validates the by-wallet list against the documented
    // `{ success, data: { jobs, total, page, limit } }` envelope with
    // snake_case summary rows, so present loosely shaped fixtures that way.
    const body = toByWalletEnvelope(raw, jobs);
    return { ...res, ok: res.ok ?? true, status: res.status ?? 200, json: async () => body };
  };
  // A proxy keeps the stub's own properties (e.g. vi.fn's `.mock`) reachable.
  return new Proxy(inner as object, {
    apply: (_target, _thisArg, args) => wrapped(args[0] as string, args[1]),
    get: (target, prop) => (prop === WRAPPED ? true : Reflect.get(target, prop, target)),
  });
}
