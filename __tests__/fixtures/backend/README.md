# Backend response fixtures

Verbatim copies of the bodies the escrow backend actually returns for the two
on-chain endpoints `app/lib/transactions.ts` drives. They are kept as files
(rather than inline literals in the tests) so they can be diffed against the
backend's routes and OpenAPI document when either side changes.

Sources in `Goldii-locks/escrow-backend`:

| Fixture                                | Source                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `build-tx-success.json`                | `router.post("/build-tx")` → `res.json({ success: true, xdr })`                                                    |
| `build-tx-error.json`                  | `sendError(res, 500, "Internal server error")`                                                                     |
| `build-tx-validation-error.json`       | `validateWithFields` middleware (`details` + `fields`)                                                             |
| `submit-success.json`                  | `sendSuccess(res, await server.sendTransaction(tx))`                                                               |
| `submit-error.json`                    | `sendError(res, status, message)` from `classifySubmitError`                                                       |
| `submit-validation-error.json`         | `validate` middleware on `/submit`                                                                                 |
| `submit-success-legacy-flat-hash.json` | Pre-envelope shape (`{ status, hash }`), kept so the frontend tolerates a backend that has not been redeployed yet |

Notes:

- `sendSuccess` wraps the payload as `{ success: true, data }`, so the
  transaction hash lives at `data.hash` — **not** at the top level.
- `/build-tx` is the exception: it returns `{ success: true, xdr }` inline.
- Schema rejections are 400s shaped
  `{ success: false, error: "ValidationError", message, details, fields }`.
