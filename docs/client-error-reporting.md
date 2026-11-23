# Client error reporting

The frontend can report client-side failures to the backend so broken flows
show up in logs instead of only in users' browser consoles.

## Enabling

Set `NEXT_PUBLIC_CLIENT_ERROR_REPORTING=true`. Reports are sent with
`POST ${NEXT_PUBLIC_BACKEND_URL}/api/client-errors` (JSON). Reporting is off by
default, and failures to report are silently ignored. The client sends at most
10 reports per minute per tab; the backend endpoint should apply its own rate
limit too.

## What is reported

Reporting lives in `app/lib/errorReporter.ts`:

- **Non-OK API responses** (`reportApiResponse`): the route template
  (e.g. `/api/jobs/:contractId`), HTTP status and `X-Request-Id` header.
- **Unrecognised transaction errors**: the `formatTxError` fallback branches.
- **Render errors**: error boundaries should call
  `reportClientError({ source: "render", message })`.

Each report contains: `source`, `message`, `route`, `status`, `requestId`, the
current page path and a timestamp.

## What is never collected

- Transaction/envelope XDRs. Base64 runs of 60+ characters are replaced with
  `[redacted-xdr]`.
- Full Stellar addresses. `G…`/`C…` addresses are truncated to their first and
  last four characters (`GABC…WXYZ`).
- Query strings, form contents, signatures, cookies or wallet secrets.
- Messages are capped at 500 characters.
