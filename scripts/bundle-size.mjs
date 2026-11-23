#!/usr/bin/env node
/**
 * Measure first-load JavaScript for each statically exported route.
 *
 * `next build` (output: "export") writes one HTML document per route in out/.
 * We sum the gzipped size of every <script src> referenced by that document,
 * which is the JavaScript a browser downloads before the route renders.
 *
 * Usage:
 *   node scripts/bundle-size.mjs             # compare against bundle-budget.json
 *   node scripts/bundle-size.mjs --update    # rewrite budgets with 10% headroom
 */
import { gzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUT = join(ROOT, "out");
const BUDGET_FILE = join(ROOT, "bundle-budget.json");
const HEADROOM = 1.1;
const ROUTES = {
  "/": "index.html",
  "/dashboard": "dashboard.html",
  "/create": "create.html",
  "/admin": "admin.html",
};

function firstLoadJs(htmlFile) {
  const html = readFileSync(join(OUT, htmlFile), "utf8");
  const srcs = new Set(
    [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]),
  );

  let total = 0;
  for (const src of srcs) {
    total += gzipSync(readFileSync(join(OUT, src.split("?")[0]))).length;
  }
  return total;
}

const measured = Object.fromEntries(
  Object.entries(ROUTES).map(([route, htmlFile]) => [
    route,
    firstLoadJs(htmlFile),
  ]),
);

if (process.argv.includes("--update")) {
  const budgets = Object.fromEntries(
    Object.entries(measured).map(([route, bytes]) => [
      route,
      Math.ceil(bytes * HEADROOM),
    ]),
  );
  writeFileSync(BUDGET_FILE, `${JSON.stringify(budgets, null, 2)}\n`);
  console.log(`Updated ${BUDGET_FILE}`);
}

const budgets = JSON.parse(readFileSync(BUDGET_FILE, "utf8"));
let failed = false;

const rows = Object.entries(measured).map(([route, bytes]) => {
  const budget = budgets[route];
  const ok = budget === undefined || bytes <= budget;
  if (!ok) failed = true;
  return `| ${route} | ${(bytes / 1024).toFixed(1)} kB | ${budget === undefined ? "-" : `${(budget / 1024).toFixed(1)} kB`} | ${ok ? "✅" : "❌"} |`;
});

console.log(
  ["| Route | First-load JS (gzip) | Budget | Result |", "| --- | --- | --- | --- |", ...rows].join("\n"),
);

if (process.env.GITHUB_STEP_SUMMARY) {
  const summary = [
    "## First-load JavaScript budgets",
    "",
    ["| Route | First-load JS (gzip) | Budget | Result |", "| --- | --- | --- | --- |", ...rows].join("\n"),
    "",
  ].join("\n");
  const { appendFileSync } = await import("node:fs");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}

if (failed) process.exitCode = 1;
