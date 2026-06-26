import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useSettingsStore } from "@/stores/settings";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function locale(): string {
  return useSettingsStore.getState().language === "en" ? "en-US" : "es-GT";
}

/**
 * Format a monetary amount using the configured currency symbol, e.g. Q1,234.50.
 * The symbol/decimals come from Settings (default Q / 2 decimals).
 */
export function formatQ(amount: number): string {
  const sym = useSettingsStore.getState().currencySymbol || "Q";
  const n = (amount ?? 0).toLocaleString(locale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sym}${n}`;
}

/** Alias with a clearer name; same behavior as formatQ. */
export const formatMoney = formatQ;

/** Format a stock amount, trimming trailing zeros (e.g. 5, 4.5, 0.008). */
export function formatStock(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  return parseFloat(value.toFixed(4)).toString();
}

/** Format an ISO/SQLite datetime string for display in es-GT. */
export function formatDateTime(iso: string): string {
  const d = parseSqliteDate(iso);
  return d.toLocaleString(locale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string): string {
  const d = parseSqliteDate(iso);
  return d.toLocaleDateString(locale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * SQLite CURRENT_TIMESTAMP returns UTC as "YYYY-MM-DD HH:MM:SS" (no timezone).
 * Parse it as UTC so local display is correct.
 */
export function parseSqliteDate(iso: string): Date {
  if (!iso) return new Date(NaN);
  // Already has timezone info or T separator handled by Date.
  if (iso.includes("T")) return new Date(iso);
  return new Date(iso.replace(" ", "T") + "Z");
}
