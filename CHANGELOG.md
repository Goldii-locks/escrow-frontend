# Changelog

All notable user-visible changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Production deploys to milestonepay.app are recorded under dated headings.

## [Unreleased]

### Added

- Recover stray tokens from an escrow with "Recover excess funds" (#898)
- Approve several delivered milestones in one transaction (#899)
- Arbiter fee and payout shown before a dispute is resolved (#900)
- "Needs your action" list at the top of the dashboard, sorted by deadline (#888)

### Changed

- Transactions prepared by the backend are checked against the requested call before the wallet is asked to sign (#889)

### Fixed

- Keyboard and screen-reader users can jump to the main content on the landing and app pages (#968)
- The job activity timeline refreshes after an action and when the dashboard poll sees new activity (#892)

### Removed

## [2026-10-18] - 689017a

### Added

- Wallet selector modal (#704)
- Milestone cap on create forms (#700)
- Status badges on the contract pause switch (#544)
- Freeze and unfreeze toasts on the contract pause switch (#545)
- Contract pause switch on the admin page (#542)
- Admin whitelist panel toasts, CSV export, and grid layout (#530)
- Emergency freeze panel layout on the admin page (#527)
- Arbiter panel empty states and short-screen layout (#521)
- Dedicated accessible arbiter dispute resolution panel (#519)
- Fee copy and contact mailbox on the landing page (#399)
- Marketing landing nav and wordmark restyle (#398)
- Rebuilt landing page (#397)
- HTTPS on milestonepay.app, with HTTP redirected (#395)
- Loading-spinner validation messages and alerts (#387)
- Signature-rejection handling in the wallet flow (#385)
- Mobile viewport styling for the dispute raise modal (#383)
- Gas estimation warning banners (#377)
- Dispute raise modal with validation messages and alerts (#375)
- Milestone notification badge (#366)

### Not user-visible

These were merged in this deploy but no route mounts them, or they were
removed later, so they can't be found in the UI. They are listed here so the
"Added" section only names features users can reach.

- Client refund panel (#556) and its toasts and freeze-history export (#568):
  removed in #586
- Platform metrics charts (#555): removed in #609 (see also #704 below)
- Admin fee configuration with confirmations, toasts, and CSV export (#537):
  there is no fee UI (#610)
- Freelancer claim panel toasts and export (#535): removed in #587
- Arbitrator evidence list on the dispute page (#557), loaded from the backend
  (#522): not mounted by any page, and calls `/api/disputes`, which doesn't
  exist
- Dispute timeline and resolution voting form (#533): not mounted by any page,
  and calls `/api/disputes`
- Dispute history timeline with badges, confirmations, toasts, and CSV export
  (#532): not mounted by any page, and calls `/api/disputes`
- Role-gated dispute details (#527): not mounted by any page
- Dark mode switcher (#367): not mounted by any page

### Changed

- Landing security copy and page metadata (#701)
- Wallet storage is cleared on disconnect (#700)
- Transaction progress bar empty state and accessibility (#525)

### Fixed

- Whitelist parsing and claim eligibility (#701)
- Amount input validation (#700)
- Rate-limit responses return JSON 429 (#700)
- Wallet availability in the transaction signer (#553)
- Wallet badge overlay and clickability on mobile (#369)

### Removed

- Unused transaction progress bar and platform metrics charts (#704)
