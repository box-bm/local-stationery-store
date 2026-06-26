import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Ensure a working localStorage (some jsdom setups don't expose it globally).
function ensureLocalStorage() {
  const probe = globalThis as { localStorage?: Storage };
  try {
    if (probe.localStorage) {
      probe.localStorage.setItem("__probe__", "1");
      probe.localStorage.removeItem("__probe__");
      return;
    }
  } catch {
    /* fall through to polyfill */
  }
  const store = new Map<string, string>();
  const mem: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (k) => store.delete(k),
    setItem: (k, v) => void store.set(k, String(v)),
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: mem,
    configurable: true,
  });
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
      value: mem,
      configurable: true,
    });
  }
}
ensureLocalStorage();

// jsdom doesn't implement matchMedia, which the settings store reads at load.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});
