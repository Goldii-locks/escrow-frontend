# Security Policy

## Overview
This security policy covers the **Escrow & GridPay Frontend**, client-side wallet connectors, and integration boundaries with Soroban / Stellar smart contracts. We take security seriously and welcome responsible disclosure of vulnerabilities from the community and security researchers.

---

## Security Scope

### In Scope
- Client-side application (`app/`, `components/`, `lib/`, `context/`).
- Wallet connection handlers (Freighter, Albedo, Ledger USB bridge, Rabe, xBull, Hana).
- Access restriction wrappers and role authorization validation logic (`admin`, `arbiter`, `client`, `freelancer`).
- Input sanitization against Cross-Site Scripting (XSS), script payloads, HTML tag injection, and CSV formula injection.
- UI state consistency, loading skeletons, error boundaries, and race condition mitigations.
- Data query mapping bindings and transaction signing interfaces.

### Out of Scope
- Third-party browser extension internals (e.g., vulnerabilities solely inside Freighter or Albedo extensions).
- Network-level attacks on public Stellar Horizon / Soroban RPC nodes outside of frontend handling.
- Social engineering, phishing, or physical attacks on users or maintainers.

---

## Threat Model

### 1. Client-Side XSS and Script Injection
- **Threat**: Malicious actors inserting `<script>`, `<iframe>`, `javascript:`, or event handlers (`onerror`, `onload`) into user-controlled fields (dispute reasons, evidence descriptions, invoice notes, token addresses, refund explanations).
- **Mitigation**: Strict input sanitization across all forms (`client_refund_panel_sanitize`, `freelancer_claim_panel_sanitize`, `arbitration_escrow_details_sanitize`), rejecting code tags and stripping executable patterns.

### 2. Frontend Access Control Bypass
- **Threat**: Unauthorized wallets accessing restricted administrative or dispute arbitration actions (e.g. non-arbiters viewing sealed dispute evidence or triggering resolution votes).
- **Mitigation**: Role-based access gates (`AdminAccessGate`, `resolveEscrowPartyRole`, `resolveFreelancerClaimAccess`, `resolveClientRefundAccess`) that verify connected wallet addresses against contract records before rendering interactive controls into the DOM.

### 3. Front-Running & Mempool Monitoring
- **Threat**: Counter-party evidence submission deadline front-running or transaction sandwiching.
- **Mitigation**: Inclusion of grace periods, dispute timer extensions, optimistic UI indicators, and multi-sig verification prompts before critical settlement actions.

### 4. CSV Formula Injection (Spreadsheet Injection)
- **Threat**: Exported transaction or dispute logs containing cells starting with `=`, `+`, `-`, or `@` that execute malicious commands when opened in spreadsheet software.
- **Mitigation**: Cell escaping using leading apostrophes (`'`) and RFC-4180 CSV escaping across all export utilities.

---

## Reporting a Vulnerability

If you discover a security vulnerability in this project, **please do NOT create a public GitHub issue**. Instead, submit your report privately to our security team.

### Submission Channels
- **Security Email**: `security@gridpay.network`
- **PGP Key ID**: `0x4A8F29C7E1B394D0`
- **PGP Fingerprint**: `94B3 E28A 7F1C 0D45 61A9  8E02 4A8F 29C7 E1B3 94D0`

### PGP Public Key
```
-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: OpenPGP.js v4.10.10
Comment: https://openpgpjs.org

mQGNBF+Z6A4BDAC7mN...[GridPay Security Team Public PGP Key]...
...
=0X9A
-----END PGP PUBLIC KEY BLOCK-----
```

### Report Contents
When reporting a vulnerability, please include:
1. Description of the vulnerability and its potential impact.
2. Step-by-step instructions or proof-of-concept (PoC) to reproduce the issue.
3. Affected components, files, or endpoints.
4. Any proposed fixes or remediations.

---

## Coordinated Disclosure Timelines

We adhere to coordinated vulnerability disclosure best practices:

| Phase | Timeline | Description |
|---|---|---|
| **Initial Acknowledgement** | Within 24-48 hours | Confirmation of receipt and initial assessment by the security team. |
| **Triage & Reproduction** | Within 3-5 business days | Severity grading (CVSS v3.1) and reproducible confirmation. |
| **Patch Development & Testing** | Within 7-14 business days | Private development, testing, and review of remediation patch. |
| **Release & Public Disclosure** | Within 30 days | Deployment of the fix to production and publication of security advisory. |

---

## Bug Bounty & Recognition
Security researchers who responsibly disclose verified vulnerabilities in accordance with this policy will receive:
- Public credit in the release notes and security hall of fame (unless anonymity is requested).
- Consideration for bug bounty rewards based on severity (Critical, High, Medium, Low).
