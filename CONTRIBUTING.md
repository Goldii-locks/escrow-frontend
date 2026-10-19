# Contributing to Milestone Escrow Frontend

Thank you for your interest in contributing! This document outlines the process for making contributions.

## Getting Started

1. Fork the repository on GitHub
2. Clone your forked repo locally
3. Install dependencies: `npm install`
4. Run the development server: `npm run dev`

## Making Changes

1. Create a new branch for your feature/fix: `git checkout -b my-feature`
2. Make your changes to the codebase
3. Write tests for new functionality (if applicable)
4. Verify the app runs correctly: `npm run dev`
5. Ensure the code builds: `npm run build`

## Code Style

Follow the project's existing code style and use ESLint to check:
```bash
npm run lint
```

## Test file convention

**All test files must live in `__tests__/` at the repository root.**

- Correct: `__tests__/my_feature.test.ts`
- Wrong: `app/lib/__tests__/my_feature.test.ts`
- Wrong: `app/components/MyComponent.test.tsx` (co-located)

Use `@/app/...` absolute aliases in imports — relative imports such as
`"../MyComponent"` are not valid from the root `__tests__/` directory:

```ts
// ✓ correct
import { fetchWhitelistedTokens } from "@/app/lib/whitelist";

// ✗ wrong (relative import from a nested location)
import { fetchWhitelistedTokens } from "../whitelist";
```

A check script enforces this convention.  Run it before opening a PR:

```bash
npm run check-test-locations
```

This exits with code 1 and lists any misplaced test files if the rule is violated.

## Submitting Changes

1. Commit your changes with a clear, descriptive message: `git commit -m "feat: add XYZ functionality"`
2. Push your branch to your fork: `git push origin my-feature`
3. Open a pull request (PR) on the main repository
4. Your PR will be reviewed and merged after approval

## Reporting Issues

If you find a bug or have a feature request, please open an issue on GitHub with clear details:
- Steps to reproduce the problem (if bug)
- Expected behavior
- Actual behavior
- System information (Node version, OS, etc.)

## Code of Conduct

We expect all contributors to be respectful and inclusive in their interactions.
