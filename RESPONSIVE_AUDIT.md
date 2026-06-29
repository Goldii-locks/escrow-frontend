# Responsive / Mobile Pass (#14)

Checked the interactive pages at common mobile widths (**375px** and **414px**) for
horizontal scroll, cut-off content, cramped controls, and touch-target size.

## Components referenced by the issue

The issue lists a **countdown timer**, a **progress bar**, and the **admin panel**.
A full-repo search (`app/**`, components, hooks) found **no countdown-timer or
progress-bar component** in the codebase — only the admin panel, dashboard, and Create
Job form exist today. There was nothing to scale for the timer/progress bar, so this pass
covers the three pages that do exist. If those components are added later, they should be
re-checked at the same widths.

## Issues found and fixed

| Page | Issue at 375/414px | Fix |
|---|---|---|
| Dashboard | The Client/Freelancer/Arbiter values render full 56-char `G…` addresses in `font-mono` with no wrapping, forcing **horizontal scroll** and cut-off text. | Added `break-all` so addresses wrap, `text-xs` to fit the narrow column, and `min-w-0` on the grid cells. |
| Admin panel | Whitelisted-token rows put a 56-char address `<span class="truncate">` directly in a flex row; without `min-w-0` the flex item can't shrink, so `truncate` never engages and the row **overflows**. | Added `min-w-0` to the address span so it truncates instead of overflowing. |
| Admin panel | "Remove" button was `px-3 py-1.5` (~28px tall) — below the recommended **44px** touch target. | Enlarged to `px-4 py-2.5` with `min-h-[44px]` and centered content. |
| Create Job form | Icon-only `✕` remove buttons (assets/requirements/milestones) were `px-2 py-2` (~32–36px) — under 44px. | Added `min-h-[44px] min-w-[44px]` so they meet the minimum tap target. |

## Verified OK (no change needed)

- **Create Job form** — page is `max-w-xl` with `px-4 sm:px-6`; the wizard step list is
  `grid-cols-1` and only becomes 3 columns at `sm:`; all inputs are `w-full`. No overflow.
- **Dashboard job-info grid** — `grid-cols-1 md:grid-cols-3` stacks vertically on mobile.
- **MilestoneCard** — `flex-col` on mobile, switching to row at `sm:`; status badge and
  action buttons use `flex-wrap`; the amount uses `truncate` inside a `min-w-0` wrapper.
- **Navbar** — wraps within its flex row; links/pill/buttons remain reachable.

## Acceptance criteria

- **No horizontal scroll / cut-off content** at 375px and 414px — the address overflow on
  the dashboard and the admin token row (the two real offenders) are resolved.
- **Touch targets** — the small "Remove" and `✕` buttons now meet the 44px minimum; the
  primary submit/add buttons were already `py-3`.

## Verification

- `npm run type-check`: clean.
- `vitest`: test baseline unchanged (no new failures introduced by these layout-only edits).
