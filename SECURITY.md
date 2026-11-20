# Security Policy

This app builds and signs transactions that move users' escrowed funds, so we
treat security reports as a priority.

## Reporting a vulnerability

**Please do not open a public issue, discussion or pull request for a
security problem.**

Report it privately through GitHub's private vulnerability reporting:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Describe the problem, how to reproduce it, and its impact.

Only the maintainers can see the report. We will acknowledge it, keep you
updated while we investigate, and credit you in the advisory if you want.

Please give us a reasonable time to ship a fix before disclosing the issue
publicly.

## Scope

In scope:

- This repository (`escrow-frontend`): the Next.js app, its Docker image,
  `nginx.conf` and the GitHub Actions workflows.
- The deployed app at `milestonepay.app` and its subdomains.

Examples of what we want to hear about:

- Cross-site scripting, or any way to run script in the app's origin.
- Transaction substitution or tampering: anything that makes the app ask a
  wallet to sign a different contract, method, argument or amount than the
  one the user saw.
- Ways to make the app show a wrong amount, recipient or job state before
  signing.
- Leaking wallet session data, or bypassing the CSP or other security headers.
- Supply-chain issues in the build or deploy pipeline.

Out of scope here (report them to the right repository instead):

- The Soroban contract: [Goldii-locks/escrow-contract](https://github.com/Goldii-locks/escrow-contract).
- The backend API: [Goldii-locks/escrow-backend](https://github.com/Goldii-locks/escrow-backend).
- Bugs in wallet extensions or the Stellar network itself.
- Reports that need a compromised device, browser or wallet, and automated
  scanner output with no demonstrated impact.

## Supported versions

Only the latest deploy of `main` is supported. Fixes are not backported.
