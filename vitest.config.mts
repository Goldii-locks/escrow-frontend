import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Native Vite tsconfig-path resolution. The 40+ test files in __tests__/
// rely on `@/app/...` aliases defined in tsconfig.json (`paths: { "@/*":
// ["./*"] }`); this `resolve.tsconfigPaths` flag replaces the legacy
// `vite-tsconfig-paths` plugin. The flag is nested under `resolve` because
// this Vite version's `ViteUserConfigExport` type only exposes it there
// (the top-level shorthand `tsconfigPaths: true` is rejected by tsc as an
// unknown property and by vitest startup at runtime).
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    // Default to the lightweight "node" environment so the ~70 pure-logic
    // `.test.ts` files in __tests__ (mapping, sanitize, badges, export,
    // toasts, etc.) no longer pay the jsdom setup cost that dominated the
    // suite (~666s environment vs ~172s tests on main).  Files that need a
    // DOM opt back in with a `// @vitest-environment jsdom` pragma at the
    // top of the file — this covers every `.test.tsx` (component render
    // tests) and the handful of `.test.ts` files that touch `window`,
    // `document`, `navigator`, or `@testing-library/react`.
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    server: {
      deps: {
        // `@stellar/freighter-api` ships CommonJS (main: build/index.min.js,
        // no "exports"/"module"), so its named exports cannot be resolved
        // statically. `@creit.tech/stellar-wallets-kit` re-exports them, which
        // is how `WalletContext` pulls them in — every test that renders a
        // context-dependent component hits this. Inlining both routes them
        // through the dep optimizer, which interops the named exports.
        inline: ["@stellar/freighter-api", /@creit\.tech\/stellar-wallets-kit/],
      },
    },
  },
});
