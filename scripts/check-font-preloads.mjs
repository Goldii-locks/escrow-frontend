#!/usr/bin/env node
/**
 * Guards the route-group font split (#863). Run after `next build`.
 *
 * The landing page must preload only the three marketing families (Inter,
 * Instrument Serif, IBM Plex Mono; five files including the serif italic and
 * the second mono weight). App pages must preload only Geist + Geist Mono.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "out");

function fontPreloads(file) {
  const html = readFileSync(join(OUT, file), "utf8");
  return new Set(
    [...html.matchAll(/<link[^>]+href="([^"]+\.woff2)"[^>]*as="font"/g)].map(
      (match) => match[1],
    ),
  );
}

const marketing = fontPreloads("index.html");
const app = fontPreloads("dashboard.html");

const failures = [];
if (marketing.size !== 5) {
  failures.push(`index.html should preload 5 marketing font files, got ${marketing.size}`);
}
if (app.size !== 2) {
  failures.push(`dashboard.html should preload 2 Geist font files, got ${app.size}`);
}
const shared = [...marketing].filter((href) => app.has(href));
if (shared.length > 0) {
  failures.push(`font preloads shared by / and /dashboard: ${shared.join(", ")}`);
}

if (failures.length > 0) {
  console.error(failures.map((f) => `❌ ${f}`).join("\n"));
  process.exit(1);
}
console.log(
  `✅ marketing fonts: ${marketing.size}, app fonts: ${app.size}, no overlap`,
);
