/**
 * Normalisation of the backend's job list and job detail payloads into
 * `Job`s. Shared by the dashboard list and the "Needs your action" panel
 * (#888) so both read the same shapes the same way.
 *
 * The job *list* (`GET /api/jobs/by-wallet/:address`) and the job *detail*
 * (`GET /api/jobs/:contractId`) are two different backend responses with two
 * different field sets:
 *
 *  - List rows are snake_case summaries (`contract_id`, `milestone_count`,
 *    `latest_event_type`, `latest_ledger`, `latest_timestamp`). They carry no
 *    client/freelancer/funded/milestones; those come from the detail call.
 *  - Detail rows are camelCase (`id`, `client`, `funded`, `milestones`).
 *
 * Each path validates its own shape against `api_schemas.ts`. There is no
 * envelope guessing and no snake_case → camelCase alias table: the list schema
 * matches `escrow-backend`'s `getJobsByWallet` exactly, and a row that fails
 * validation is reported (not silently dropped) so contract drift fails a
 * test instead of hiding rows from the user.
 */
import {
  JobSchema,
  JobSummarySchema,
  type Job,
  type JobListResponse,
  type JobSummary,
} from "@/app/lib/api_schemas";
import { reportClientError } from "@/app/lib/errorReporter";

/** Route template used when reporting unparseable list rows. */
const BY_WALLET_ROUTE = "/api/jobs/by-wallet/:address";

/**
 * Maps one snake_case by-wallet summary row onto the camelCase `Job` the UI
 * renders. This is the single translation point between the list's wire
 * shape and the app's model — not an alias lookup, because the field sets
 * differ and a missing/renamed field must fail loudly rather than fall
 * through to a default.
 */
function summaryToJob(summary: JobSummary): Job {
  return JobSchema.parse({
    id: summary.contract_id,
    role: summary.role,
    milestoneCount: summary.milestone_count,
    latestEventType: summary.latest_event_type,
    latestEventAt: summary.latest_timestamp ?? undefined,
    latestLedger: summary.latest_ledger,
  });
}

/**
 * Normalises a raw detail payload (`GET /api/jobs/:contractId`'s `data`) into
 * a `Job`. Returns `null` when the shape does not match `JobSchema` so the
 * caller can fall back to the contract rather than render partial data.
 */
export function normalizeJob(item: unknown): Job | null {
  const result = JobSchema.safeParse(item);
  return result.success ? result.data : null;
}

/** The page envelope `parsePageResponse` extracts from a validated response. */
export interface JobListPage {
  jobs: Job[];
  page: number;
  limit: number;
  total: number;
}

/**
 * Reads the by-wallet list response into `Job`s using the single documented
 * shape. `payload` is the already-validated `JobListResponse` from
 * `validateResponse(JobListResponseSchema, raw, endpoint)`.
 *
 * Each row is validated against `JobSummarySchema`; a row that fails is
 * reported via `reportClientError` and skipped so one bad row does not blank
 * the whole list, while the failure is still visible to the error reporter.
 */
export function parsePageResponse(payload: JobListResponse): JobListPage {
  const empty: JobListPage = { jobs: [], page: 1, limit: 5, total: 0 };
  if (payload.success === false) return empty;

  const jobs: Job[] = [];
  const { jobs: rows, page, limit, total } = payload.data;

  for (const row of rows) {
    const parsed = JobSummarySchema.safeParse(row);
    if (!parsed.success) {
      reportClientError({
        source: "api",
        message: `Unparseable job row in by-wallet response: ${parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
        route: BY_WALLET_ROUTE,
      });
      continue;
    }
    try {
      jobs.push(summaryToJob(parsed.data));
    } catch (err) {
      reportClientError({
        source: "api",
        message: `Job row failed summary→Job mapping: ${
          err instanceof Error ? err.message : String(err)
        }`,
        route: BY_WALLET_ROUTE,
      });
    }
  }

  return { jobs, page, limit, total };
}