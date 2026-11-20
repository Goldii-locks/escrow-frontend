#!/usr/bin/env node
/**
 * scripts/reachability.mjs
 *
 * Lists modules under `app/` that no route can reach, i.e. files that are not
 * imported (directly or transitively) from any Next.js entry file: pages,
 * layouts, route handlers, and the other App Router special files.
 *
 * Changing an unreachable module does not change what users see, so check
 * here before extending one. See "Live vs unreferenced code" in
 * CONTRIBUTING.md.
 *
 * Usage:
 *   node scripts/reachability.mjs          # list unreachable modules
 *   node scripts/reachability.mjs --live   # list reachable modules instead
 *
 * The import scan is regex-based and has no dependencies. It follows static
 * `import`/`export ... from`, side-effect imports, dynamic `import()` and
 * `require()` with string literals, resolving relative paths and the `@/`
 * alias from tsconfig.json. Stories and type declarations are ignored.
 *
 * Exit code is always 0; the output is informational.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const APP_DIR = join(ROOT, "app");
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs"];
const ENTRY_NAMES = new Set([
  "page",
  "layout",
  "template",
  "loading",
  "error",
  "global-error",
  "not-found",
  "default",
  "route",
  "robots",
  "sitemap",
  "manifest",
  "icon",
  "apple-icon",
  "opengraph-image",
  "twitter-image",
]);
const ROOT_ENTRIES = ["middleware", "instrumentation"];
const IMPORT_PATTERN =
  /(?:import|export)\s[^"';]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']|(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g;

const showLive = process.argv.includes("--live");

function isModule(file) {
  return (
    EXTENSIONS.some((ext) => file.endsWith(ext)) &&
    !file.endsWith(".d.ts") &&
    !/\.stories\.[cm]?[jt]sx?$/.test(file)
  );
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (isModule(full)) {
      out.push(full);
    }
  }
  return out;
}

function baseName(file) {
  const name = file.slice(file.lastIndexOf(sep) + 1);
  return name.slice(0, name.indexOf("."));
}

function resolveFile(base) {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of EXTENSIONS) {
    if (existsSync(base + ext)) return base + ext;
  }
  for (const ext of EXTENSIONS) {
    const index = join(base, `index${ext}`);
    if (existsSync(index)) return index;
  }
  return null;
}

function resolveSpecifier(specifier, fromFile) {
  if (specifier.startsWith("@/")) return resolveFile(join(ROOT, specifier.slice(2)));
  if (specifier.startsWith(".")) return resolveFile(resolve(dirname(fromFile), specifier));
  return null; // package import
}

const appModules = walk(APP_DIR);
const entries = [
  ...appModules.filter((file) => ENTRY_NAMES.has(baseName(file))),
  ...ROOT_ENTRIES.map((name) => resolveFile(join(ROOT, name))).filter(Boolean),
];

const reached = new Set();
const queue = [...entries];
while (queue.length > 0) {
  const file = queue.pop();
  if (reached.has(file)) continue;
  reached.add(file);
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const target = resolveSpecifier(match[1] ?? match[2] ?? match[3], file);
    if (target && isModule(target) && !reached.has(target)) queue.push(target);
  }
}

const listed = appModules
  .filter((file) => reached.has(file) === showLive)
  .map((file) => relative(ROOT, file))
  .sort();

let lines = 0;
for (const file of listed) {
  const count = readFileSync(join(ROOT, file), "utf8").split("\n").length;
  lines += count;
  console.log(`${file} (${count} lines)`);
}

console.log(
  `\n${listed.length} ${showLive ? "reachable" : "unreachable"} module(s), ${lines} lines, ` +
    `from ${entries.length} entry file(s).`
);
