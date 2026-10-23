/**
 * Guards for issue #681 — the unused client-side transaction builders that
 * used to live in `app/lib/contract.ts`.
 *
 * `app/lib/contract.ts` exported `getContract()`, `buildTx()`,
 * `addressToScVal()` and `i128ToScVal()` plus a module-level
 * `new Server(RPC_URL)`. Nothing imported them — every transaction is built by
 * the backend's `/api/jobs/build-tx` — so the module has been replaced by
 * `app/lib/config.ts`, which holds only the env constants.
 *
 * These assertions fail if the builders or the eagerly-constructed RPC client
 * come back, because a second signing path is exactly the divergence risk the
 * issue was filed against.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BACKEND_URL,
  CONTRACT_ID,
  NETWORK_PASSPHRASE,
  RPC_URL,
  createRpcServer,
  validateBackendUrl,
} from "@/app/lib/config";

const REPO_ROOT = resolve(__dirname, "..");
const CONFIG_PATH = resolve(REPO_ROOT, "app/lib/config.ts");

/** Every `.ts`/`.tsx` file under `app/`, excluding co-located tests. */
function appSourceFiles(dir = resolve(REPO_ROOT, "app")): string[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readdirSync } = require("node:fs") as typeof import("node:fs");
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : appSourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("app/lib/contract.ts is gone", () => {
  it("no longer exists", () => {
    expect(existsSync(resolve(REPO_ROOT, "app/lib/contract.ts"))).toBe(false);
  });

  it("is not imported from anywhere in app/ or __tests__/", () => {
    const offenders = [...appSourceFiles(), ...appSourceFiles(resolve(REPO_ROOT, "__tests__"))]
      .filter((file) => file !== CONFIG_PATH && file !== __filename)
      .filter((file) => /lib\/contract(?!_)/.test(readFileSync(file, "utf8")))
      .map((file) => file.slice(REPO_ROOT.length + 1));
    expect(offenders).toEqual([]);
  });
});

describe("app/lib/config.ts", () => {
  // Comments mention the old `new Server(` call; only executable code matters.
  const source = readFileSync(CONFIG_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("exposes the deployment env constants", () => {
    expect(RPC_URL).toMatch(/^https?:\/\//);
    expect(NETWORK_PASSPHRASE.length).toBeGreaterThan(0);
    expect(typeof BACKEND_URL).toBe("string");
    expect(typeof CONTRACT_ID).toBe("string");
  });

  it("exports no transaction builders", () => {
    [
      "function getContract",
      "function buildTx",
      "function addressToScVal",
      "function i128ToScVal",
    ].forEach((name) => expect(source).not.toContain(name));
  });

  it("never constructs an RPC Server at module scope", () => {
    // A `new Server(` at the top level of the module body would run on import.
    expect(source).not.toMatch(/^export const \w+ = new Server\(/m);
    expect(source).not.toMatch(/^\s*new Server\(/m);
    // The only `new Server(` left is inside the lazy factory.
    expect(source.match(/new Server\(/g)).toHaveLength(1);
    expect(source).toContain("export async function createRpcServer()");
  });
});

describe("createRpcServer", () => {
  it("builds a client on demand rather than at import time", async () => {
    const server = await createRpcServer();
    expect(typeof server.getAccount).toBe("function");
  });
});

describe("validateBackendUrl", () => {
  it("accepts https URLs", () => {
    expect(validateBackendUrl("https://api.example.com")).toEqual({ ok: true });
  });

  it("accepts http://localhost:3001", () => {
    expect(validateBackendUrl("http://localhost:3001")).toEqual({ ok: true });
  });

  it("accepts http://127.0.0.1", () => {
    expect(validateBackendUrl("http://127.0.0.1")).toEqual({ ok: true });
  });

  it("accepts http://[::1]:3001", () => {
    expect(validateBackendUrl("http://[::1]:3001")).toEqual({ ok: true });
  });

  it("accepts an empty string", () => {
    expect(validateBackendUrl("")).toEqual({ ok: true });
  });

  it("accepts undefined", () => {
    expect(validateBackendUrl(undefined)).toEqual({ ok: true });
  });

  it("rejects http://example.com", () => {
    const result = validateBackendUrl("http://example.com");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("http://example.com");
  });

  it("rejects ftp://x", () => {
    const result = validateBackendUrl("ftp://x");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("ftp://x");
  });
});
