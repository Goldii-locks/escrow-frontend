# Escrow Frontend

Next.js frontend for the Soroban milestone escrow smart contract on Stellar.

## Live Contract

The contract ID is injected at build time via the `NEXT_PUBLIC_CONTRACT_ID`
environment variable. In CI it comes from the `CONTRACT_ID` repo variable
(see [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — the
deploy workflow resolves the ID with this priority: manual override → repo
variable → error). The value below is a stale snapshot kept for reference
only; point your browser at the deployed site and copy the ID from the
admin page, or read it from the repo variable.

| Network | Contract ID                                                        |
| ------- | ------------------------------------------------------------------ |
| Testnet | `NEXT_PUBLIC_CONTRACT_ID` (set at build time; see deploy workflow) |

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

| Variable                                 | Default                                             | Purpose                                                                                                                                                                     |
| ---------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_CONTRACT_ID`                | _(required)_                                        | Soroban contract ID the frontend talks to. In CI this comes from the `CONTRACT_ID` repo variable; the deploy workflow allows a manual override via the `contract_id` input. |
| `NEXT_PUBLIC_BACKEND_URL`                | `http://localhost:3001`                             | Base URL of the escrow backend API (used by `app/lib/transactions.ts`).                                                                                                     |
| `NEXT_PUBLIC_SOROBAN_RPC_URL`            | `https://soroban-testnet.stellar.org`               | Soroban RPC endpoint used by `app/lib/contract.ts`.                                                                                                                         |
| `NEXT_PUBLIC_SOROBAN_NETWORK_PASSPHRASE` | `Networks.TESTNET` (`Test SDF Future Network 2025`) | Network passphrase used by `app/lib/contract.ts`; set to `Networks.MAINNET` (`Public Global Stellar Network 2022`) for mainnet.                                             |

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
  --build-arg NEXT_PUBLIC_CONTRACT_ID=CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH \
  .

# HTTPS backend
docker build -t escrow-frontend \
  --build-arg NEXT_PUBLIC_BACKEND_URL=https://api.example.com \
  --build-arg NEXT_PUBLIC_CONTRACT_ID=CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH \
  .

# Local loopback
docker build -t escrow-frontend \
  --build-arg NEXT_PUBLIC_BACKEND_URL=http://localhost:3001 \
  --build-arg NEXT_PUBLIC_CONTRACT_ID=CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH \
  .

# Rejected: plain HTTP remote (fails the build)
docker build -t escrow-frontend \
  --build-arg NEXT_PUBLIC_BACKEND_URL=http://example.com \
  --build-arg NEXT_PUBLIC_CONTRACT_ID=CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH \
  .
```

## Related Repos

- `https://github.com/Goldii-locks/escrow-contract` — Soroban smart contract
