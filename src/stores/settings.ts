import { create } from "zustand";
import type { Lang } from "@/i18n/translations";

export type ThemeMode = "light" | "dark" | "system";

export interface SettingsState {
  language: Lang;
  theme: ThemeMode;
  /** Whether dark styles are currently applied (resolves "system"). */
  isDark: boolean;
  currencySymbol: string;
  currencyCode: string;
  storeName: string;

  lockEnabled: boolean;
  lockHash: string | null;

  onboardingDone: boolean;

  setLanguage: (l: Lang) => void;
  setTheme: (t: ThemeMode) => void;
  setCurrency: (symbol: string, code: string) => void;
  setStoreName: (name: string) => void;
  setLock: (enabled: boolean, hash: string | null) => void;
  setOnboardingDone: (done: boolean) => void;
}

const KEY = "libreria-settings";

interface Persisted {
  language: Lang;
  theme: ThemeMode;
  currencySymbol: string;
  currencyCode: string;
  storeName: string;
  lockEnabled: boolean;
  lockHash: string | null;
  onboardingDone: boolean;
}

const DEFAULTS: Persisted = {
  language: "es",
  theme: "system",
  currencySymbol: "Q",
  currencyCode: "GTQ",
  storeName: "Mi Librería",
  lockEnabled: false,
  lockHash: null,
  onboardingDone: false,
};

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore corrupt settings */
  }
  return { ...DEFAULTS };
}

function persist(p: Persisted) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

function systemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function resolveDark(theme: ThemeMode): boolean {
  if (theme === "system") return systemPrefersDark();
  return theme === "dark";
}

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

const initial = load();
applyTheme(resolveDark(initial.theme));

export const useSettingsStore = create<SettingsState>((set, get) => {
  function snapshot(): Persisted {
    const s = get();
    return {
      language: s.language,
      theme: s.theme,
      currencySymbol: s.currencySymbol,
      currencyCode: s.currencyCode,
      storeName: s.storeName,
      lockEnabled: s.lockEnabled,
      lockHash: s.lockHash,
      onboardingDone: s.onboardingDone,
    };
  }

  return {
    ...initial,
    isDark: resolveDark(initial.theme),

    setLanguage: (language) => {
      set({ language });
      persist({ ...snapshot(), language });
    },

    setTheme: (theme) => {
      const isDark = resolveDark(theme);
      applyTheme(isDark);
      set({ theme, isDark });
      persist({ ...snapshot(), theme });
    },

    setCurrency: (currencySymbol, currencyCode) => {
      set({ currencySymbol, currencyCode });
      persist({ ...snapshot(), currencySymbol, currencyCode });
    },

    setStoreName: (storeName) => {
      set({ storeName });
      persist({ ...snapshot(), storeName });
    },

    setLock: (lockEnabled, lockHash) => {
      set({ lockEnabled, lockHash });
      persist({ ...snapshot(), lockEnabled, lockHash });
    },

    setOnboardingDone: (onboardingDone) => {
      set({ onboardingDone });
      persist({ ...snapshot(), onboardingDone });
    },
  };
});

// Keep "system" theme in sync with OS changes.
if (window.matchMedia) {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      const { theme, setTheme } = useSettingsStore.getState();
      if (theme === "system") setTheme("system");
    });
}
