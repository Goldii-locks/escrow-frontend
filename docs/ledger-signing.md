# Ledger hardware wallet signing

Ledger is offered through `@creit.tech/stellar-wallets-kit` (WebHID / WebUSB) and listed in `SUPPORTED_WALLETS` (`app/context/WalletContext.tsx`). Helpers live in `app/lib/ledger_support.ts`.

## Requirements

- A Chromium-based desktop browser (Chrome, Edge, Brave, Opera). Firefox and Safari lack WebHID/WebUSB; the wallet list shows a disabled Ledger entry with an explanation instead of failing silently.
- Ledger Stellar app with Soroban support (the version that can sign Soroban authorization entries, 5.x or later at the time of writing) and "Blind signing" / "Enable Soroban" style settings enabled on the device. Soroban invocations are not human-readable on the device, so blind signing is required.
- The device must be unlocked with the Stellar app open before connecting.

## Signing timeout

Device confirmation takes longer than a software wallet. `LEDGER_SIGNATURE_TIMEOUT_MS` (180 s) documents the budget; the wallet context's default 60 s bound (`DEFAULT_WALLET_SIGNATURE_TIMEOUT_MS`) is capped by the transaction's own `maxTime`.

## Manual test notes (testnet)

1. Open the app in Chrome, click Connect, choose Ledger, approve the browser's device prompt.
2. Confirm the Stellar account address matches the one shown on the device.
3. Create a job and fund it. "Confirm on your device" shows while signing; approve on the Ledger.
4. Approve a milestone and confirm the transaction succeeds on testnet.
5. Reject on the device and confirm the app shows the rejection state.
6. Open the app in Firefox or Safari and confirm Ledger is disabled with the unsupported-browser message.
