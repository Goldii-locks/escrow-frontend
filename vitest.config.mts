import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: [
      {
        find: "@creit.tech/stellar-wallets-kit/modules/utils",
        replacement: path.resolve(
          __dirname,
          "__tests__/__mocks__/@creit.tech/stellar-wallets-kit/modules/utils.ts"
        ),
      },
      {
        find: "@creit.tech/stellar-wallets-kit",
        replacement: path.resolve(
          __dirname,
          "__tests__/__mocks__/@creit.tech/stellar-wallets-kit.ts"
        ),
      },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  optimizeDeps: {
    exclude: ["@creit.tech/stellar-wallets-kit"],
  },
});
