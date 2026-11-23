#!/usr/bin/env node
/**
 * scripts/coverage-summary.mjs
 *
 * Turns `coverage/coverage-summary.json` (written by `npm run test:coverage`)
 * into a Markdown report: the totals, the live route pages and
 * `app/lib/transactions.ts` first, then every other file (#598).
 *
 * The report goes to `$GITHUB_STEP_SUMMARY` when set (CI), otherwise stdout.
 *
 * Usage:
 *   npm run test:coverage && node scripts/coverage-summary.mjs
 */

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(new URL(".", import.meta.url)));
const SUMMARY_PATH = resolve(ROOT, "coverage/coverage-summary.json");

// The pages users actually reach (the create page is split into its form
// hook, validators and submit module), plus the module that builds every
// contract call. These are listed first so their numbers aren't lost in the long tail.
const KEY_FILES = [
  "app/page.tsx",
  "app/(app)/create/page.tsx",
  "app/(app)/create/useCreateJobForm.ts",
  "app/(app)/create/validation.ts",
  "app/(app)/create/submit.ts",
  "app/(app)/dashboard/page.tsx",
  "app/(app)/admin/page.tsx",
  "app/lib/transactions.ts",
];

if (!existsSync(SUMMARY_PATH)) {
  console.error(`No coverage summary at ${SUMMARY_PATH}; run npm run test:coverage first.`);
  process.exit(1);
}

const summary = JSON.parse(readFileSync(SUMMARY_PATH, "utf8"));

const pct = (metric) => `${metric.pct.toFixed(1)}%`;
const row = (name, m) =>
  `| \`${name}\` | ${pct(m.statements)} | ${pct(m.branches)} | ${pct(m.functions)} | ${pct(m.lines)} |`;
const HEADER = [
  "| File | Statements | Branches | Functions | Lines |",
  "| --- | --: | --: | --: | --: |",
];

const files = new Map();
for (const [path, metrics] of Object.entries(summary)) {
  if (path === "total") continue;
  files.set(relative(ROOT, path).replaceAll("\\", "/"), metrics);
}

const lines = ["## Test coverage", "", ...HEADER, row("All files", summary.total), ""];

lines.push("### Route pages and transactions", "", ...HEADER);
for (const name of KEY_FILES) {
  const metrics = files.get(name);
  lines.push(metrics ? row(name, metrics) : `| \`${name}\` | not instrumented | | | |`);
}

const rest = [...files.keys()].filter((name) => !KEY_FILES.includes(name)).sort();
lines.push(
  "",
  `<details><summary>All ${files.size} files</summary>`,
  "",
  ...HEADER,
  ...rest.map((name) => row(name, files.get(name))),
  "",
  "</details>",
  ""
);

const report = lines.join("\n");
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
} else {
  console.log(report);
}
