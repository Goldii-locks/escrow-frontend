# E2E suite (#854)

Hermetic Playwright flow covering the client, freelancer and arbiter roles
against the **real UI**. No wallet extension, backend or external network is
needed:

- `helpers.ts` seeds a connected Freighter session with `page.addInitScript`
  and answers the wallet bridge's postMessage protocol. `signTransaction`
  returns the unsigned XDR unchanged.
- `helpers.ts` routes every `/api/**` call to in-memory fixtures that advance
  state (e.g. `initialize` creates a funded job). Every `build-tx` and `submit`
  body is recorded so the specs can assert the exact transaction arguments.
- `serve.mjs` serves the static export in `out/` with the same extensionless
  route fallback as nginx.

## Run locally

```bash
npm run build
npm run test:e2e:install   # once: Playwright + chromium
npm run test:e2e
```

Playwright is installed under `e2e/` with its own lockfile so the root
`package-lock.json` stays untouched. Vitest explicitly excludes `e2e/**`.

CI runs the specs in a dedicated step with a 2-minute timeout.
