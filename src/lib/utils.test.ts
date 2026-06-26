import { describe, it, expect, beforeEach } from "vitest";
import { formatQ, formatStock, parseSqliteDate } from "./utils";
import { useSettingsStore } from "@/stores/settings";

describe("formatStock", () => {
  it("shows integers without decimals", () => {
    expect(formatStock(5)).toBe("5");
    expect(formatStock(0)).toBe("0");
  });

  it("trims trailing zeros on fractional values", () => {
    expect(formatStock(4.5)).toBe("4.5");
    expect(formatStock(0.008)).toBe("0.008");
  });
});

describe("parseSqliteDate", () => {
  it("interprets the SQLite timestamp as UTC", () => {
    const d = parseSqliteDate("2026-06-26 12:30:00");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(5); // June (0-indexed)
    expect(d.getUTCDate()).toBe(26);
    expect(d.getUTCHours()).toBe(12);
  });
});

describe("formatQ", () => {
  beforeEach(() => {
    useSettingsStore.getState().setCurrency("Q", "GTQ");
    useSettingsStore.getState().setLanguage("es");
  });

  it("formats with the configured symbol and 2 decimals", () => {
    expect(formatQ(0)).toBe("Q0.00");
    expect(formatQ(2.5)).toBe("Q2.50");
  });

  it("groups thousands", () => {
    expect(formatQ(1234.5)).toMatch(/^Q1[.,]234[.,]50$/);
  });

  it("respects a custom currency symbol", () => {
    useSettingsStore.getState().setCurrency("$", "USD");
    expect(formatQ(5)).toBe("$5.00");
  });
});
