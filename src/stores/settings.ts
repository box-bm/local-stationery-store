import { create } from "zustand";
import type { Lang } from "@/i18n/translations";

export type ThemeMode = "light" | "dark" | "system";

/** Card was intentionally removed; only these methods are configurable. */
export type PaymentMethodId = "cash" | "transfer";
export type PaymentMethods = Record<PaymentMethodId, boolean>;

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

  paymentMethods: PaymentMethods;

  onboardingDone: boolean;

  /** Rows per page in the Ventas list. */
  salesPageSize: number;

  setLanguage: (l: Lang) => void;
  setTheme: (t: ThemeMode) => void;
  setCurrency: (symbol: string, code: string) => void;
  setStoreName: (name: string) => void;
  setLock: (enabled: boolean, hash: string | null) => void;
  setPaymentMethod: (id: PaymentMethodId, enabled: boolean) => void;
  setOnboardingDone: (done: boolean) => void;
  setSalesPageSize: (size: number) => void;
}

/** Page sizes offered in Settings; sizes above this are flagged as risky for performance. */
export const SALES_PAGE_SIZE_OPTIONS = [25, 50, 100, 250] as const;
export const SALES_PAGE_SIZE_WARNING_THRESHOLD = 250;

const KEY = "libreria-settings";

interface Persisted {
  language: Lang;
  theme: ThemeMode;
  currencySymbol: string;
  currencyCode: string;
  storeName: string;
  lockEnabled: boolean;
  lockHash: string | null;
  paymentMethods: PaymentMethods;
  onboardingDone: boolean;
  salesPageSize: number;
}

const DEFAULTS: Persisted = {
  language: "es",
  theme: "system",
  currencySymbol: "Q",
  currencyCode: "GTQ",
  storeName: "Mi Librería",
  lockEnabled: false,
  lockHash: null,
  paymentMethods: { cash: true, transfer: true },
  onboardingDone: false,
  salesPageSize: 50,
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
      paymentMethods: s.paymentMethods,
      onboardingDone: s.onboardingDone,
      salesPageSize: s.salesPageSize,
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

    setPaymentMethod: (id, enabled) => {
      const paymentMethods = { ...get().paymentMethods, [id]: enabled };
      set({ paymentMethods });
      persist({ ...snapshot(), paymentMethods });
    },

    setOnboardingDone: (onboardingDone) => {
      set({ onboardingDone });
      persist({ ...snapshot(), onboardingDone });
    },

    setSalesPageSize: (salesPageSize) => {
      set({ salesPageSize });
      persist({ ...snapshot(), salesPageSize });
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
