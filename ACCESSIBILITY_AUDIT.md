# Accessibility Audit — Dashboard & Create Job (#13)

Scope: the two main interactive pages — **Create Job** (`app/create/page.tsx`) and
**Dashboard** (`app/dashboard/page.tsx`) — plus the shared components they render
(`Navbar`, `MilestoneCard`, `LoadingSkeleton`, `TxStatusBanner`, `ButtonSpinner`).

Target: WCAG 2.1 **AA**, keyboard operability, and screen-reader usability.

## What was checked

### 1. Labels / ARIA on interactive elements
- **Create Job form** — every input has an associated `<label htmlFor>`; dynamically
  added rows (accepted assets, requirements, milestones) carry `aria-label` and their
  remove buttons have `aria-label="Remove …"`; the wizard step buttons expose
  `aria-pressed`; the form error uses `role="alert"`. **No issues found** — already compliant.
- **MilestoneCard** — status badge has an `aria-label` ("Milestone N status: …"), action
  buttons have descriptive `aria-label`s, error banners use `role="alert"`/`aria-live`,
  and decorative/redundant text is `aria-hidden`. **No labeling issues found.**
- **Navbar** — links/buttons are native and labeled by text, but the logo emoji was read
  aloud and the wallet pill only exposed a truncated address. **Fixed** (below).
- **Dashboard** — the error message was a plain `<div>` (not announced) and the funded
  status leaned on an emoji. **Fixed** (below).

### 2. Keyboard navigation
- All interactive elements are native `<button>` / `<a>` / `<input>` — reachable and
  operable via Tab/Enter/Space. No positive `tabindex`, no keyboard traps, no
  click-only handlers on non-interactive elements.
- The Create Job form, wizard step buttons, add/remove row buttons, and submit button
  all tab in a logical order and operate from the keyboard.
- **Gap found:** the app's design system applies explicit `focus-visible` rings to inputs,
  form buttons, and milestone controls, but the **Navbar links/buttons had no
  `focus-visible` styling**, so keyboard focus there relied on the (faint, dark-background)
  default outline. **Fixed** by adding consistent focus rings.

### 3. Color contrast (WCAG AA — 4.5:1 normal text, 3:1 large)
Measured against the design tokens in `app/globals.css` (page bg `#030712`).

| Element | Before | Ratio | Status |
|---|---|---|---|
| Dashboard "Connect wallet" / "No jobs found" (`text-gray-500` `#6b7280`) | on `#030712` | ~4.2:1 | ❌ fail → **fixed** to `text-gray-400` (~7:1) |
| Create "Connect your wallet" hint (`text-text-disabled` `#6b7280`) | on `#030712` | ~4.2:1 | ❌ fail → **fixed** to `text-text-muted` (~7:1) |
| "Mark Delivered" button — white text on `bg-info-soft` `#60a5fa` | | ~2.4:1 | ❌ fail → **fixed** to dark text (`text-surface-page`, ~7.5:1; background unchanged) |
| "Approve" button — white text on `bg-success` `#16a34a` | | ~3.3:1 | ❌ fail → **fixed** to dark text (`text-surface-page`, ~5.8:1; background unchanged) |
| "Dispute" button — white on `bg-danger` `#991b1b` | | ~11:1 | ✅ pass (unchanged) |
| Status badges (soft tints, e.g. `text-warning-soft`/`info-soft`/`success-soft` on dark) | | >7:1 | ✅ pass (unchanged) |
| Navbar links (`text-gray-300` on `#030712`) | | ~12:1 | ✅ pass; wallet pill bumped `gray-400 → gray-300` for margin |

### 4. Status & loading announcements
- `TxStatusBanner` already uses `role="alert"` (errors) and `role="status"` (success). **OK.**
- **Gap found:** `LoadingSkeleton` was purely decorative with no announcement, so
  screen-reader users got silence while the dashboard fetched. **Fixed** with
  `role="status"`, an `aria-live` region, and a visually-hidden "Loading job data…" label,
  with the skeleton markup marked `aria-hidden`.

## What was fixed

| File | Change |
|---|---|
| `app/dashboard/page.tsx` | `role="alert"` on the error message; `text-gray-500 → text-gray-400` (contrast); funded status emoji wrapped in `aria-hidden` with the text label kept |
| `app/components/LoadingSkeleton.tsx` | `role="status"` + `aria-live="polite"` + visually-hidden "Loading job data…"; decorative markup `aria-hidden` |
| `app/components/Navbar.tsx` | `aria-label="Primary"` on `<nav>`; consistent `focus-visible` rings on all links/buttons; logo emoji `aria-hidden`; wallet pill exposes the full address via `aria-label` and uses higher-contrast text |
| `app/components/MilestoneCard.tsx` | "Mark Delivered" and "Approve" buttons switched to dark text (`text-surface-page`) on their existing `bg-info-soft`/`bg-success` backgrounds to meet AA (backgrounds left unchanged so design-token tests keep passing) |
| `app/create/page.tsx` | wallet hint `text-text-disabled → text-text-muted` (contrast); success-screen heading promoted from `<h2>` to `<h1>` (no `<h1>` existed in that state); success checkmark `aria-hidden` |

## No regressions

- No functional/behavioral code changed — edits are limited to ARIA attributes, CSS
  utility classes, and one heading level.
- Test baseline is unchanged: `vitest` reports **184 passed** with the same 2 pre-existing
  failures that fail on `main` without these changes (`create-job-form-layout` placeholder
  assertion and a `milestone-card-layout` empty-state assertion) — both unrelated to a11y.
  `milestone-card-a11y.test.tsx` (roles/accessible names) and the milestone design-token
  layout tests all pass.
- `npm run type-check` passes clean. `npm run lint` reports only the 2 pre-existing
  `react-hooks` errors in `admin/page.tsx` and `dashboard/page.tsx` (the `useEffect` hook),
  which are present on `main` and untouched here.

## Notes / follow-ups (out of scope here)

- The Dashboard's `Mark Delivered` / `Approve` / `Dispute` handlers are currently
  `alert()` placeholders pending contract wiring; once implemented they should surface
  results through `TxStatusBanner` (already accessible) rather than `alert()`.
- A future pass could add an automated axe-core check to CI to prevent regressions.
