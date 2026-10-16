# Contributing to Milestone Escrow Frontend

This guide covers checkout through pull request. Automated checks need no wallet or transaction.

## Prerequisites and checkout

- Git, a POSIX shell (or Git Bash/WSL), Node.js **24.x**, and npm.
- Internet access for npm packages and the public Stellar Testnet RPC.
- This checkout uses Next.js **16.3.0** and React **19.2.4**; use
  [package.json](package.json) rather than older stack descriptions.
- Before changing Next.js code, follow [AGENTS.md](AGENTS.md) and read the relevant
  installed guide under `node_modules/next/dist/docs/`.

Fork [Goldii-locks/escrow-frontend](https://github.com/Goldii-locks/escrow-frontend)
on GitHub. Replace `YOUR_GITHUB_USERNAME` below with your account name:

```sh
git clone https://github.com/YOUR_GITHUB_USERNAME/escrow-frontend.git
cd escrow-frontend
git remote add upstream https://github.com/Goldii-locks/escrow-frontend.git
git switch -c my-change
node --version
npm --version
npm ci
cp .env.local.example .env.local
```

Node must report `v24.x`. Keep this terminal in `escrow-frontend`.
`npm ci` uses the lockfile; do not regenerate it for unrelated changes.

## Configure and start both services

### 1. Backend: a second terminal

From the directory containing your frontend checkout, clone the companion repo
as a sibling. Skip the clone if you already have it:

```sh
git clone https://github.com/Goldii-locks/escrow-backend.git
cd escrow-backend
npm ci
cp .env.example .env
npm run build
NODE_ENV=development npm start
```

The example environment supplies port `3001`, the public Testnet contract below,
and the Testnet RPC; no private key is needed. Leave it running. It starts HTTP,
local SQLite, and the read-only indexer. RPC failures can affect indexed data
independently of server health.

Use the compiled startup above: at backend revision
`e6793b076c32a378e6d8902119396cdc3755fd35`, `npm run dev` was observed to fail
under the ts-node ESM loader with `TS2349` at `helmet()`; build plus start worked.
This is development mode; production additionally requires `API_KEY`,
`ADMIN_API_KEY`, and `ALLOWED_ORIGINS`. Do not use this local setup as a deployment.

### 2. Frontend: the first terminal

Edit your ignored `.env.local` to contain all four public values:

```dotenv
NEXT_PUBLIC_CONTRACT_ID=CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_SOROBAN_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

Copy the passphrase exactly, including spaces and the semicolon. `NEXT_PUBLIC_*`
values enter the browser bundle: never put secrets there. Restart after editing.

```sh
npm run dev -- --hostname 127.0.0.1
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Explicit loopback binding also
avoids an `os.networkInterfaces / uv_interface_addresses` error observed in a
restricted runtime. If a port is occupied, stop your earlier server before retrying;
the URLs in this guide assume frontend `3000` and backend `3001`.

### 3. Check the local run

In another terminal:

```sh
curl --fail http://127.0.0.1:3001/health
curl --fail --output /dev/null http://127.0.0.1:3000/
curl --fail --output /dev/null http://127.0.0.1:3000/create
curl --fail --output /dev/null http://127.0.0.1:3000/dashboard
curl --fail --output /dev/null http://127.0.0.1:3000/admin
```

Health should return `{"status":"ok","contract":"CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH"}`.
The four pages should return HTTP 200. In the browser, check the landing page,
the disconnected create/dashboard states, and the admin access gate.
A rendered admin page does not grant access. HTTP checks alone do not establish
browser hydration or a successful transaction.
Stop each server with Ctrl+C when finished.
`next dev` can regenerate the tracked Next.js block in `AGENTS.md`. Review
`git diff -- AGENTS.md` before committing. If that diff is solely generated and
you made no intentional edits to that file, restore it with `git restore -- AGENTS.md`;
otherwise preserve and review your intentional changes.

The frontend uses `output: "export"` in [next.config.ts](next.config.ts).
`npm run build` writes the static site to `out/`; `next start` is not the
serving path for this export. The backend's `npm start` is a separate script.

## Find the live implementation before editing

Start at the route entry and follow its imports; similarly named standalone
components may not be wired into the app.

| Entry | Components and behavior | Main helpers |
| --- | --- | --- |
| [app/layout.tsx](app/layout.tsx) | Shared WalletProvider, ToastProvider, toast, wallet/ledger loaders, gas and signature warnings | [WalletContext](app/context/WalletContext.tsx), [ToastContext](app/context/ToastContext.tsx) |
| [app/page.tsx](app/page.tsx), `/` | LandingNav, LandingLogo, LandingArrow | [contract.ts](app/lib/contract.ts), [network.ts](app/lib/network.ts) |
| [app/create/page.tsx](app/create/page.tsx), `/create` | The actual create form, Navbar, ButtonSpinner, TxStatusBanner | [transactions.ts](app/lib/transactions.ts), [whitelist.ts](app/lib/whitelist.ts), [errors.ts](app/lib/errors.ts) |
| [app/dashboard/page.tsx](app/dashboard/page.tsx), `/dashboard` | MilestoneCard, DisputeRaiseModal, ArbiterActionPanel, loading/empty states | [useActionStates](app/hooks/useActionStates.ts), [transactions.ts](app/lib/transactions.ts), [autoRelease.ts](app/lib/autoRelease.ts) |
| [app/admin/page.tsx](app/admin/page.tsx), `/admin` | AdminAccessGate, whitelist confirmation, ContractPauseSwitch | [useIsAdmin](app/hooks/useIsAdmin.ts), [admin_whitelist_panel.ts](app/lib/admin_whitelist_panel.ts), [contract_pause_switch.ts](app/lib/contract_pause_switch.ts) |

Navbar imports the capitalized [NotificationBell.tsx](app/components/NotificationBell.tsx)
and [WalletBadge.tsx](app/components/WalletBadge.tsx).

At frontend revision `ae62f6efd75611907bc5996f6cb5e0e593ba1603`, following local
runtime imports and literal dynamic imports from the four pages plus layout
reaches the modules below (type-only imports excluded). The five entry files
are already listed in the table; paths in each group are relative to that folder.

<details>
<summary>Complete reachable module inventory</summary>

```text
app/components/
  AdminAccessGate.tsx  AdminWhitelistSkeleton.tsx  ArbiterActionPanel.tsx
  ButtonSpinner.tsx  ContractPauseSwitch.tsx  CountdownTimer.tsx
  DisputeRaiseModal.tsx  EmptyStateCard.tsx  GasEstimationWarningBanner.tsx
  LandingArrow.tsx  LandingLogo.tsx  LandingNav.tsx
  LedgerLoaderOverlay.tsx  LoadingSkeleton.tsx  MilestoneCard.tsx
  Navbar.tsx  NotificationBell.tsx  SignatureTimeoutAlert.tsx
  SignatureTimeoutFeeWarningBanner.tsx  Toast.tsx  TxStatusBanner.tsx
  WalletBadge.tsx  WalletLoaderOverlay.tsx  WhitelistConfirmModal.tsx
app/context/
  ToastContext.tsx  WalletContext.tsx
app/
  globals.css  landing.css
app/hooks/
  useActionStates.ts  useAlbedoMultiSigAssembly.ts  useArbiterPanelViewport.ts
  useDisputeViewport.ts  useIsAdmin.ts  useLedgerMultiSigAssembly.ts
app/lib/
  admin.ts  admin_whitelist_panel.ts  albedo_connector.ts
  amounts.ts  arbiter_action_panel.ts  autoRelease.ts
  contract.ts  contract_pause_switch.ts  dispute_raise_modal.ts
  errors.ts  freighter_connector.ts  ledger_usb_bridge.ts
  network.ts  signature_timeout_alert.ts  stellar.ts
  theme_tokens.ts  transactions.ts  wallet_state_context.ts
  wallet_state_store.ts  whitelist.ts
```

</details>

This is import reachability, not proof that every export or conditional UI runs.
Other frontend modules are not reached by that walk; inspect and wire the
intended caller before treating an isolated helper change as an app fix.
For example, [CreateJobForm.tsx](app/components/forms/CreateJobForm.tsx),
[WalletStateContext.tsx](app/context/WalletStateContext.tsx),
[ThemeContext.tsx](app/context/ThemeContext.tsx),
[TransactionSigner.tsx](app/components/TransactionSigner.tsx), and
[TransactionSignerPanel.tsx](app/components/TransactionSignerPanel.tsx) are not
reachable from those entries. Their unit tests do not prove route integration.

The companion backend has its own
[architecture map](https://github.com/Goldii-locks/escrow-backend/blob/main/docs/ARCHITECTURE.md)
and `node scripts/reachability.mjs` (run inside `escrow-backend`).
That script walks backend imports from `src/index.ts`; it does not classify
frontend modules.

## Tests, fixtures, and checks

Run these from the frontend root:

```sh
npm test -- __tests__/amounts.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism
npm test -- __tests__/create-page.test.tsx __tests__/admin-whitelist-panel.test.tsx --pool=forks --maxWorkers=2
npm test -- --pool=forks --maxWorkers=2
npm run type-check
npm run lint -- --max-warnings 0
npm run build
git diff --check
```

Start with the unit and route tests, then run the full suite. Test changed behavior
through the affected route. Keep worker counts low on small machines.
Allow several minutes: issue #691 reports about 6.5 minutes on its machine;
the recorded two-worker run below took about 108 seconds. Timing and test counts
depend on the revision and hardware, so record your actual result.

Tests use Vitest + jsdom, configured in [vitest.config.mts](vitest.config.mts);
[vitest.setup.ts](vitest.setup.ts) installs jest-dom and browser API/storage stubs.
Tests live in [__tests__/](__tests__) and [app/components/__tests__/](app/components/__tests__).
There is no `npm run format` script; follow nearby TypeScript, React, and Tailwind style.

Use existing fixtures rather than a real account:

- [create-page.test.tsx](__tests__/create-page.test.tsx) mocks navigation, wallet,
  and fetch; a whitelist response is
  `{ success: true, data: [{ address: "CTOKEN", symbol: "USDC" }] }`.
- [admin-whitelist-panel.test.tsx](__tests__/admin-whitelist-panel.test.tsx) shows
  admin access, successful/failed transaction mocks, confirmation, and cleanup
  with `vi.unstubAllGlobals()`.
- [ledger_usb_bridge_multisig.test.ts](__tests__/ledger_usb_bridge_multisig.test.ts)
  builds offline XDR with ephemeral in-memory keypairs. These are test fixtures,
  not funded wallets. Do not add network submission to unit tests.

For backend work, use its separate Jest suite and
[create-job-draft.test.ts](https://github.com/Goldii-locks/escrow-backend/blob/main/__tests__/create-job-draft.test.ts):
draft inputs are `client`, `freelancer`, `arbiter`, `token`,
`autoReleaseDays`, and `milestones: [{ amount: "10000000" }]` (integer-string
base units). Creating a draft does not sign or submit a transaction.
[build-tx-address-validation.test.ts](https://github.com/Goldii-locks/escrow-backend/blob/main/__tests__/build-tx-address-validation.test.ts)
uses `contractId`, `method`, array `args`, and `sourceAddress`;
[history.test.ts](https://github.com/Goldii-locks/escrow-backend/blob/main/__tests__/history.test.ts)
shows in-memory SQLite setup. Do not substitute older README payload names
`operation` or `sourceAccount` for the current schema.

**Recorded baseline:** frontend revision `ae62f6e`, Node `24.19.0`, npm `11.9.0`:
215 test files / 3,660 tests passed, type-check and build passed.
Strict lint exited 1 with **23 existing warnings and 0 errors**.
The zero-warning command is the target, not a passing baseline. Report remaining
warnings with the revision and output; do not suppress them or claim a green check.
For a documentation-only PR, disclose inherited failures for maintainer review.
Mocks do not provide a global network-isolation guarantee.

## Optional: exercise a Testnet wallet flow

A wallet is unnecessary for the checks above. For wallet UI or contract actions,
use a dedicated Testnet account and the official
[Freighter Testnet guide](https://developers.stellar.org/docs/build/guides/freighter/connect-testnet).
Install/unlock Freighter, select **Testnet**, and connect it from the app.
If a test account needs funds, use Testnet Friendbot as described in
[Stellar Lab accounts](https://developers.stellar.org/docs/tools/lab/account).
Friendbot supplies test XLM for fees; it does not supply every whitelisted
escrow token. A transaction also needs an accepted token and sufficient test
balance for the selected contract, not just a connected wallet.
Never use a production account or put a seed phrase in this repo or a PR.

Confirm the wallet network matches the RPC, passphrase, and contract.
Only then test the intended action, inspect its wallet prompt, and record the
Testnet transaction result. Admin operations also require the contract's admin
identity. The baseline above checked anonymous pages and mocked tests; it did
not validate a funded wallet, signing prompt, or on-chain transaction.

## Submit a focused pull request

1. Keep unrelated fixes and generated files out of your diff. Review `git diff`
   and `git status --short`; never commit `.env.local`, credentials, `out/`,
   `.next/`, or `node_modules/`.
2. Run the relevant tests and checklist above. For visible UI changes, attach
   screenshots and describe keyboard, loading, error, and disconnected behavior.
3. Commit and push your branch to your fork:

   ```sh
   git add CONTRIBUTING.md  # replace with the files you actually changed
   git commit -m "docs: clarify contributor setup"
   git push -u origin my-change
   ```

4. Open a PR against `Goldii-locks/escrow-frontend:main`. Link the issue,
   explain the resulting behavior, and list exact checks, failures, and any
   wallet/transaction paths not exercised. Describe any AI assistance honestly.
5. Address review comments, rerun checks affected by revisions, and let
   maintainers decide approval and merge.

Before requesting review, check:

- [ ] Local frontend/backend startup and affected pages work as described.
- [ ] Behavior changes have relevant tests; full tests, type-check, build, and
      `git diff --check` results are recorded.
- [ ] Strict lint has zero warnings, or its inherited warnings are explicitly
      disclosed for maintainer review.
- [ ] The diff contains only intended source/docs and no secrets or build output.

For bug reports, open an issue with reproduction steps, expected/actual behavior,
Node/npm versions, OS, and relevant redacted logs. Keep discussion respectful.
