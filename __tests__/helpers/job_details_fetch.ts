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

export function wrapFetchWithJobDetails(): void {
  const inner = globalThis.fetch as unknown as (
    url: string,
    init?: unknown
  ) => Promise<JsonResponse>;
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
    if (!res || typeof res.json !== "function") return res;
    const body = await res.json();
    const jobs = jobsFrom(body);
    if (jobs.length > 0) lastList = jobs;
    return { ...res, ok: res.ok ?? true, status: res.status ?? 200, json: async () => body };
  };
  (globalThis as { fetch: unknown }).fetch = wrapped;
}
