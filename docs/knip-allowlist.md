# Knip allowlist

CI runs `npx knip --include files,exports,dependencies` (#809). Knip starts from route entries
(`app/**/page.tsx`, `layout.tsx`, `route.ts`) plus the Next.js plugin's entries; tests and stories
are not entries. A newly orphaned file, unused export or unused dependency fails CI.

The current findings are allowlisted in `knip.json` so the check can land before the remaining
dead-code issues are fixed. Shrink this list as those issues land.

## Dependencies

- `@storybook/blocks`, `@storybook/react`, `@storybook/test` — Storybook packages used by
  `*.stories.tsx`, which Knip does not treat as entries.
- `tailwindcss` — consumed through the PostCSS plugin rather than imported directly.

## Unused exports

`ignoreIssues` lists files whose exports are currently unreferenced from entries (generated design
tokens, legacy helpers, viewport hooks and wallet-modal helpers). They are intentionally kept for
now because their owning dead-code issues are separate; removing them here would widen the change
beyond this CI task.

## Verifying the gate

```bash
npm run knip
```

To prove the gate works, add a temporary unreachable file under `app/components/` — Knip reports
it as an unused file and exits non-zero.
