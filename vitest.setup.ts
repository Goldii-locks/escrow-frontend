import "@testing-library/jest-dom/vitest";

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
