# CSP `connect-src` origins

The Content-Security-Policy is emitted by nginx from two generated includes:

- `/etc/nginx/csp-hashes.conf` — SHA-256 hashes of inline scripts, generated at build time by
  `scripts/gen-csp-hashes.mjs`.
- `/etc/nginx/csp-origins.conf` — the `connect-src` allowlist, rendered at container start by
  `scripts/nginx-entrypoint.sh` from `nginx/templates/csp-origins.conf.template`.

## Network URLs

The entrypoint derives an origin (scheme + host + optional port) from these environment variables,
which are set from the same Docker build args as the inlined `NEXT_PUBLIC_*` bundle values:

| Variable                      | Purpose          | Testnet default                       |
| ----------------------------- | ---------------- | ------------------------------------- |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Soroban RPC      | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_HORIZON_URL`     | Horizon REST     | `https://horizon-testnet.stellar.org` |
| `NEXT_PUBLIC_EXPLORER_URL`    | Network explorer | `https://stellar.expert`              |

A mainnet build therefore emits a CSP naming the mainnet RPC and Horizon hosts, instead of the
hard-coded testnet hosts. `'`self`'` is always included.

## Wallet kit origins

These origins are always allowed because `@creit.tech/stellar-wallets-kit` talks to them directly
from the browser; they are not derived from the network URLs:

- `wss://relay.walletconnect.com` — WalletConnect relay
- `https://verify.walletconnect.com` — WalletConnect verify
- `https://lobstr.co` — LOBSTR wallet popups
- `https://albedo.link` — Albedo wallet popups

When adding a wallet connector, add its origin here and in `scripts/nginx-entrypoint.sh`, then
collect report-only violations from a testnet deployment before tightening the policy.

## Verification

`e2e/smoke.spec.ts` asserts that the `connect-src` directive includes the configured RPC origin and
the WalletConnect relay.
