import "@testing-library/jest-dom/vitest";
import { expect } from "vitest";
import type { AxeResults } from "axe-core";

// Asserts an axe-core run found no violations (#677). Kept local instead of
// pulling in vitest-axe, whose peer range trips npm's resolver here.
expect.extend({
  toHaveNoViolations(results: AxeResults) {
    const violations = results.violations;
    return {
      pass: violations.length === 0,
      actual: violations,
      message: () =>
        violations
          .map(
            (v) =>
              `${v.id} (${v.impact ?? "unknown"}): ${v.help}\n` +
              v.nodes.map((n) => `  ${n.target.join(" ")}`).join("\n"),
          )
          .join("\n\n") || "Expected axe violations, found none",
    };
  },
});

// jsdom doesn't implement matchMedia. Provide a minimal stub so any code
// that calls window.matchMedia("...").matches doesn't throw.
if (typeof window !== "undefined" && typeof window.matchMedia === "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  });
}

// jsdom environment: normalise the web-storage globals across Node versions.
//
// Newer Node releases ship an experimental `localStorage` global that reads as
// `undefined` unless `--localstorage-file` is passed, and that value shadows
// the jsdom implementation under vitest -- crashing any test that touches a
// bare `localStorage`. When the jsdom global did not install, fall back to an
// in-memory Storage so the API stays present and assertable.
//
// Defined on both `globalThis` and `window`: they are usually the same object
// under jsdom, but tests reach for either name and the fallback should not
// depend on that holding.
if (
  typeof globalThis.localStorage === "undefined" ||
  (typeof window !== "undefined" && !window.localStorage)
) {
  const createMemoryStorage = (): Storage => {
    const store = new Map<string, string>();
    return {
      get length() {
        return store.size;
      },
      clear() {
        store.clear();
      },
      getItem(key: string) {
        const value = store.get(key);
        return value === undefined ? null : value;
      },
      key(index: number) {
        return Array.from(store.keys())[index] ?? null;
      },
      removeItem(key: string) {
        store.delete(key);
      },
      setItem(key: string, value: string) {
        store.set(key, String(value));
      },
    } as Storage;
  };

  const memoryStorage = createMemoryStorage();

  Object.defineProperty(globalThis, "localStorage", {
    value: memoryStorage,
    configurable: true,
    writable: true,
  });

  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
      value: memoryStorage,
      configurable: true,
      writable: true,
    });
  }
}
