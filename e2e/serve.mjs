#!/usr/bin/env node
/**
 * Minimal static server for the Next.js `output: "export"` build.
 *
 * The deployment serves `out/` through nginx with a fallback from extensionless
 * routes to `<route>.html`. This script reproduces just that routing so the
 * Playwright suite can run without Docker.
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../out", import.meta.url));
const PORT = Number(process.env.PORT ?? 8080);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function resolveFile(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const candidate = join(ROOT, clean);
  if (candidate.startsWith(ROOT) && existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }
  for (const suffix of [".html", "/index.html"]) {
    const fallback = `${candidate}${suffix}`;
    if (fallback.startsWith(ROOT) && existsSync(fallback) && statSync(fallback).isFile()) {
      return fallback;
    }
  }
  return null;
}

createServer((req, res) => {
  const pathname = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`).pathname;
  if (pathname === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }

  const file = resolveFile(pathname === "/" ? "/index.html" : pathname);
  if (!file) {
    // Static export's 404 page, with a real 404 status.
    const notFound = join(ROOT, "404.html");
    res.writeHead(404, { "content-type": TYPES[".html"] });
    createReadStream(existsSync(notFound) ? notFound : file ?? join(ROOT, "index.html")).pipe(res);
    return;
  }

  res.writeHead(200, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(file).pipe(res);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`e2e static server listening on http://127.0.0.1:${PORT}`);
});
