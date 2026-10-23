# Contributing to Milestone Escrow Frontend

Thank you for your interest in contributing! This document outlines the process for making contributions.

## Getting Started

1. Fork the repository on GitHub
2. Clone your forked repo locally
3. Install dependencies: `npm install`
4. Run the development server: `npm run dev`

## Local setup

Use Node.js 24 (`24` in `.nvmrc`; `package.json` `engines.node` is `24.x`) and npm.

Install from the lockfile:

```bash
npm ci
```

Copy the env template and fill in values:

```bash
cp .env.local.example .env.local
```

Variables in `.env.local.example`:

- `NEXT_PUBLIC_CONTRACT_ID` — Soroban contract ID. README lists the testnet ID `CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH`.
- `NEXT_PUBLIC_BACKEND_URL` — backend origin. The example value is `http://localhost:3001`.
- `NEXT_PUBLIC_SOROBAN_RPC_URL` — Soroban RPC. The example value is `https://soroban-testnet.stellar.org`.
- `NEXT_PUBLIC_SOROBAN_NETWORK_PASSPHRASE` — network passphrase. The example value is `Test SDF Network ; September 2015`.

Start the Next.js app:

```bash
npm run dev
```

To hit a local backend, set `NEXT_PUBLIC_BACKEND_URL` to `http://localhost:3001` (the example value).

The backend lives in [Goldii-locks/escrow-backend](https://github.com/Goldii-locks/escrow-backend); start it locally with `npm install && npm run dev` (it listens on port 3001).

In a production build an empty `NEXT_PUBLIC_BACKEND_URL` means same-origin `/api` (nginx proxies it to the backend). The Docker build rejects a plain `http://` remote URL and allows `https://` and `http://localhost` / `127.0.0.1` / `[::1]`.

For on-chain testnet work, install Freighter and switch it to Stellar testnet (the example passphrase is `Test SDF Network ; September 2015`). Fund the test wallet with Stellar testnet Friendbot, the standard Stellar testnet funding service.

## Making Changes

1. Create a new branch for your feature/fix: `git checkout -b my-feature`
2. Make your changes to the codebase
3. Write tests for new functionality (if applicable)
4. Verify the app runs correctly: `npm run dev`
5. Ensure the code builds: `npm run build`

## Code Style

Follow the project's existing code style and use ESLint to check:

```bash
npm run lint
```

## Project structure

Routes live under `app/` (Next.js App Router). Pages from README:

- `/` — `app/page.tsx` (landing)
- `/create` — `app/create/`
- `/dashboard` — `app/dashboard/`
- `/admin` — `app/admin/`

Supporting directories:

- `app/components/` — React UI used by pages and layouts
- `app/lib/` — helpers (config, wallet, backend client)
- `app/hooks/` — React hooks
- `app/context/` — React context (`WalletContext`, `ToastContext`)
- `__tests__/` — every test file (see “Test file convention” below and `vitest.config.mts`)
- `public/` — static assets
- `docs/` — extra notes (not app routes)

### Live vs unreferenced code

Many modules under `app/` are not imported from any page or layout, so changing them does not change what users see. Confirm a module is actually rendered (imported from a route, layout, or a component those routes mount) before extending it. Related: GitHub issue #520.

TODO(maintainers): add or link the reachability script used to list unreferenced modules.

## Test file convention

**All test files must live in `__tests__/` at the repository root.**

- Correct: `__tests__/my_feature.test.ts`
- Wrong: `app/lib/__tests__/my_feature.test.ts`
- Wrong: `app/components/MyComponent.test.tsx` (co-located)

Use `@/app/...` absolute aliases in imports — relative imports such as
`"../MyComponent"` are not valid from the root `__tests__/` directory:

```ts
// ✓ correct
import { fetchWhitelistedTokens } from "@/app/lib/whitelist";

// ✗ wrong (relative import from a nested location)
import { fetchWhitelistedTokens } from "../whitelist";
```

A check script enforces this convention. Run it before opening a PR:

```bash
npm run check-test-locations
```

This exits with code 1 and lists any misplaced test files if the rule is violated.

## Testing

All tests are in the root `__tests__/` directory. Vitest is configured in `vitest.config.mts` (`environment: "jsdom"`, `setupFiles: ["./vitest.setup.ts"]`).

Run the full suite (`vitest run` via the `test` script). This takes roughly 6.5 minutes:

```bash
npm test
```

Run a single file (forwards the path to `vitest run`; this path exists in the repo):

```bash
npm test -- __tests__/whitelist.test.ts
```

When you add fixtures, match real backend response shapes rather than inventing payload fields.

## Pull request checklist

- [ ] `npm run lint` completes with zero warnings
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] `npm run check-test-locations` passes
- [ ] UI changes include screenshots in the PR
- [ ] The PR links the related issue
- [ ] User-facing changes include a line in `CHANGELOG.md`

## Submitting Changes

1. Commit your changes with a clear, descriptive message: `git commit -m "feat: add XYZ functionality"`
2. Push your branch to your fork: `git push origin my-feature`
3. Open a pull request (PR) on the main repository
4. Your PR will be reviewed and merged after approval

## Reporting Issues

If you find a bug or have a feature request, please open an issue on GitHub with clear details:

- Steps to reproduce the problem (if bug)
- Expected behavior
- Actual behavior
- System information (Node version, OS, etc.)

## Code of Conduct

We expect all contributors to be respectful and inclusive in their interactions.

## Changelog

PRs labelled `user-facing` must add one line under `[Unreleased]` in `CHANGELOG.md`, using the Keep a Changelog categories (Added, Changed, Fixed, Removed). Internal changes (refactors, CI, tests, docs-only) do not need an entry.

Each production deploy is then recorded under a dated heading using the titles of `user-facing` PRs.

Example: `- Arbitrator evidence list on the dispute page (#557)`
