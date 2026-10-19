#!/usr/bin/env node
/**
 * scripts/check-test-locations.mjs
 *
 * Enforces the project convention (issue #679): every test file must live
 * inside the root `__tests__/` directory. Test files anywhere else — e.g.
 * `app/components/__tests__/` or co-located `*.test.ts` — are flagged.
 *
 * Usage:
 *   node scripts/check-test-locations.mjs
 *
 * Exit code:
 *   0  — no violations found
 *   1  — one or more misplaced test files were found (list printed to stderr)
 */

import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ALLOWED_DIR = join(ROOT, "__tests__");
const TEST_PATTERN = /\.(test|spec)\.[cm]?[jt]sx?$/;
const IGNORE_DIRS = new Set(["node_modules", ".next", ".git", "__tests__", "dist", "build"]);

/**
 * Recursively walk `dir` and collect every path that matches TEST_PATTERN
 * but is NOT inside ALLOWED_DIR.
 */
function findMisplaced(dir) {
  const violations = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      violations.push(...findMisplaced(full));
    } else if (TEST_PATTERN.test(entry) && !full.startsWith(ALLOWED_DIR)) {
      violations.push(relative(ROOT, full));
    }
  }
  return violations;
}

const misplaced = findMisplaced(ROOT);

if (misplaced.length === 0) {
  console.log("✓ All test files are in __tests__/");
  process.exit(0);
} else {
  console.error(
    `\n✗ ${misplaced.length} test file(s) found outside __tests__/:\n`,
  );
  for (const f of misplaced) {
    console.error(`  ${f}`);
  }
  console.error(
    "\nMove them to __tests__/ and update their imports to use @/app/... aliases.\n" +
    "See CONTRIBUTING.md for the test file convention.\n",
  );
  process.exit(1);
}
