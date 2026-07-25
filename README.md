# Escrow Frontend

Next.js frontend for the Soroban milestone escrow smart contract on Stellar.

## Live Contract

| Network | Contract ID |
|---|---|
| Testnet | `CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH` |

## Tech Stack

- Next.js 15 + TypeScript
- Tailwind CSS
- Stellar SDK
- Freighter Wallet

## Pages

- `/` — Landing page
- `/create` — Create a new escrow job with milestones
- `/dashboard` — View job status and interact with milestones
- `/admin` — Manage whitelisted tokens (admin only)

## Setup

```bash
npm install
cp .env.local.example .env.local  # add your contract ID
npm run dev
```

## Environment Variables

NEXT_PUBLIC_CONTRACT_ID=CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH

## Related Repos

- `https://github.com/Goldii-locks/escrow-contract`  — Soroban smart contract
- Update README with latest progress
