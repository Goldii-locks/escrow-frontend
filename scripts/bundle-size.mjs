// Measures first-load JS per route from the static export in out/ and
// checks it against bundle-budget.json. Next 16 no longer prints sizes in
// `next build`, so we sum the gzipped <script src> chunks each page loads.
//
//   node scripts/bundle-size.mjs           check against the budget
//   node scripts/bundle-size.mjs --update  rewrite the budget (current + 10%)
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const OUT = "out";
const BUDGET_FILE = "bundle-budget.json";
const ROUTES = {
  "/": "index.html",
  "/dashboard": "dashboard.html",
  "/create": "create.html",
  "/admin": "admin.html",
};

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

function firstLoadJs(htmlFile) {
  const html = readFileSync(join(OUT, htmlFile), "utf8");
  const srcs = new Set([...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]));
  let total = 0;
  for (const src of srcs) {
    total += gzipSync(readFileSync(join(OUT, src.split("?")[0]))).length;
  }
  return total;
}

const sizes = Object.fromEntries(
  Object.entries(ROUTES).map(([route, file]) => [route, firstLoadJs(file)])
);

if (process.argv.includes("--update")) {
  const budget = Object.fromEntries(Object.entries(sizes).map(([r, s]) => [r, Math.ceil(s * 1.1)]));
  writeFileSync(BUDGET_FILE, JSON.stringify(budget, null, 2) + "\n");
  console.log(`Wrote ${BUDGET_FILE}`);
  process.exit(0);
}

const budget = existsSync(BUDGET_FILE) ? JSON.parse(readFileSync(BUDGET_FILE, "utf8")) : {};
let failed = false;
const rows = Object.entries(sizes).map(([route, size]) => {
  const limit = budget[route];
  const ok = limit === undefined || size <= limit;
  if (!ok) failed = true;
  return `| \`${route}\` | ${kb(size)} | ${limit ? kb(limit) : "—"} | ${ok ? "✅" : "❌ over budget"} |`;
});
const table = [
  "### First-load JS per route (gzip)",
  "",
  "| Route | Size | Budget | Status |",
  "|---|---|---|---|",
  ...rows,
  "",
].join("\n");

console.log(table);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, table + "\n");
}
if (failed) {
  console.error(
    `First-load JS exceeds ${BUDGET_FILE}. If the increase is intended, run \`node scripts/bundle-size.mjs --update\` after a build.`
  );
  process.exit(1);
}
