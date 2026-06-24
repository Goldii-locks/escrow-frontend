import type { Config } from "jest";

const config: Config = {
  // Use jsdom for a browser-like environment (DOM APIs, window, etc.)
  testEnvironment: "jest-environment-jsdom",

  // Imports @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],

  // Resolve the "@/" path alias to match tsconfig paths
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // Stub CSS imports so they don't break the transformer
    "\\.(css|less|sass|scss)$": "<rootDir>/__mocks__/styleMock.ts",
    // Stub static asset imports (svg, png, etc.)
    "\\.(gif|ttf|eot|svg|png|jpg|jpeg|webp|ico)$": "<rootDir>/__mocks__/fileMock.ts",
  },

  // Compile TypeScript / TSX with ts-jest
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
        },
      },
    ],
  },

  // Extensions Jest will resolve when following imports
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],

  // Glob patterns for test files
  testMatch: [
    "**/__tests__/**/*.(test|spec).(ts|tsx)",
    "**/?(*.)+(spec|test).(ts|tsx)",
  ],

  // Ignore build output and dependencies
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],

  // Coverage source — components only
  collectCoverageFrom: [
    "app/components/**/*.{ts,tsx}",
    "!app/components/**/*.d.ts",
  ],
};

export default config;
