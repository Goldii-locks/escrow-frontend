# Escrow Frontend

Next.js frontend for the Soroban milestone escrow smart contract on Stellar.

## Live Contract

Every escrow is its own contract, created through the escrow factory
(`create_escrow`). The only contract address the frontend is built against is
the factory's, injected at build time via `NEXT_PUBLIC_FACTORY_CONTRACT_ID`
(in CI, the `FACTORY_CONTRACT_ID` repo variable; see
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)). Job actions
target the job's own contract ID, and `/admin` lets an admin pick the escrow
to manage. The legacy single-escrow `NEXT_PUBLIC_CONTRACT_ID` is no longer
read (#836, #572).

| Network | Factory contract ID                                                        |
| ------- | -------------------------------------------------------------------------- |
| Testnet | `NEXT_PUBLIC_FACTORY_CONTRACT_ID` (set at build time; see deploy workflow) |

## Tech Stack

- Next.js 15 + TypeScript
- Tailwind CSS
- Stellar SDK
- Freighter Wallet

## Pages

- `/` — Landing page
- `/create` — Create a new escrow job with milestones
- `/dashboard` — View job status and interact with milestones
- `/admin` — Manage whitelisted tokens (admin only). Requires the contract
  admin wallet to be connected; the admin wallet is configured on the
  contract side and is not something you set here.

## Setup

### Run locally against a backend

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the example env file and fill in values:

   ```bash
   cp .env.local.example .env.local
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

4. Open http://localhost:3000.

The app defaults to testnet (`NEXT_PUBLIC_SOROBAN_RPC_URL` defaults to
`https://soroban-testnet.stellar.org` and `NEXT_PUBLIC_SOROBAN_NETWORK_PASSPHRASE`
defaults to `Networks.TESTNET`). To run against a local backend, set
`NEXT_PUBLIC_BACKEND_URL=http://localhost:3001` (the backend must serve the
allowlisted read endpoints the frontend calls).

### Run in production

The production build is produced by the AWS deploy workflow
(`.github/workflows/deploy.yml`). It inlines the `NEXT_PUBLIC_*` values as
Docker build args, so a contract change requires a rebuild — there is no
runtime override.

## Environment Variables

All `NEXT_PUBLIC_*` variables are read at build time and inlined into the
bundle.

| Variable                                 | Default                                             | Purpose                                                                                                                                                                                                                                      |
| ---------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_FACTORY_CONTRACT_ID`        | _(empty)_                                           | escrow-factory contract the create page calls (`create_escrow`); each escrow it creates is its own contract. In CI this comes from the `FACTORY_CONTRACT_ID` repo variable. Empty: the create page says escrow creation isn't available yet. |
| `NEXT_PUBLIC_BACKEND_URL`                | `http://localhost:3001`                             | Base URL of the escrow backend API (used by `app/lib/transactions.ts`).                                                                                                                                                                      |
| `NEXT_PUBLIC_SOROBAN_RPC_URL`            | `https://soroban-testnet.stellar.org`               | Soroban RPC endpoint used by `app/lib/contract.ts`.                                                                                                                                                                                          |
| `NEXT_PUBLIC_SOROBAN_NETWORK_PASSPHRASE` | `Networks.TESTNET` (`Test SDF Future Network 2025`) | Network passphrase used by `app/lib/contract.ts`; set to `Networks.MAINNET` (`Public Global Stellar Network 2022`) for mainnet.                                                                                                              |

## Backend URL (NEXT_PUBLIC_BACKEND_URL)

The site is served over HTTPS. A remote `http://` backend URL is mixed content and is rejected at Docker build time with:

`ERROR: NEXT_PUBLIC_BACKEND_URL must start with https:// (got "<value>"). Use https://, a localhost URL for local dev, or leave it empty to use same-origin /api.`

Accepted values:

- Empty / unset (recommended in production): same-origin relative `/api` paths; nginx proxies `/api`
- `https://...`
- Loopback for local dev: `http://localhost`, `http://127.0.0.1`, `http://[::1]` (optional port and path)

```bash
# Production (recommended): empty - same-origin /api
docker build -t escrow-frontend \
  --build-arg NEXT_PUBLIC_FACTORY_CONTRACT_ID=<factory contract ID> \
  .

# HTTPS backend
docker build -t escrow-frontend \
  --build-arg NEXT_PUBLIC_BACKEND_URL=https://api.example.com \
  --build-arg NEXT_PUBLIC_FACTORY_CONTRACT_ID=<factory contract ID> \
  .

# Local loopback
docker build -t escrow-frontend \
  --build-arg NEXT_PUBLIC_BACKEND_URL=http://localhost:3001 \
  --build-arg NEXT_PUBLIC_FACTORY_CONTRACT_ID=<factory contract ID> \
  .

# Rejected: plain HTTP remote (fails the build)
docker build -t escrow-frontend \
  --build-arg NEXT_PUBLIC_BACKEND_URL=http://example.com \
  --build-arg NEXT_PUBLIC_FACTORY_CONTRACT_ID=<factory contract ID> \
  .
```

## Related Repos

- `https://github.com/Goldii-locks/escrow-contract` — Soroban smart contract
