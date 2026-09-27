import { describe, it, expect, beforeEach, vi } from "vitest";

const KEY = "libreria-settings";

// The store reads localStorage once at import time, so each test loads a
// fresh copy of the module.
async function loadStore() {
  vi.resetModules();
  return (await import("./settings")).useSettingsStore;
}

function persisted() {
  return JSON.parse(localStorage.getItem(KEY) ?? "null");
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("settings store", () => {
  it("starts with defaults and bootstraps a device identity", async () => {
    const store = await loadStore();
    const s = store.getState();
    expect(s).toMatchObject({
      language: "es",
      theme: "system",
      currencySymbol: "Q",
      currencyCode: "GTQ",
      paymentMethods: { cash: true, transfer: true },
      driveSyncEnabled: false,
      salesPageSize: 50,
    });
    expect(s.deviceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(s.deviceName).toBe(`Equipo ${s.deviceId.slice(0, 4)}`);
    expect(persisted().deviceId).toBe(s.deviceId);
  });

  it("keeps the existing device id across restarts", async () => {
    const first = (await loadStore()).getState().deviceId;
    const second = (await loadStore()).getState().deviceId;
    expect(second).toBe(first);
  });

  it("merges saved values over defaults", async () => {
    localStorage.setItem(KEY, JSON.stringify({ storeName: "Librería Central", deviceId: "abc" }));
    const s = (await loadStore()).getState();
    expect(s.storeName).toBe("Librería Central");
    expect(s.currencySymbol).toBe("Q");
  });

  it("ignores corrupt saved settings", async () => {
    localStorage.setItem(KEY, "{not json");
    const s = (await loadStore()).getState();
    expect(s.language).toBe("es");
  });

  it("persists each setter", async () => {
    const store = await loadStore();
    const s = store.getState();
    s.setLanguage("en");
    s.setCurrency("$", "USD");
    s.setStoreName("Mi Tienda");
    s.setPaymentMethod("transfer", false);
    s.setSalesPageSize(100);
    s.setOnboardingDone(true);
    s.setLock(true, "hash");

    expect(persisted()).toMatchObject({
      language: "en",
      currencySymbol: "$",
      currencyCode: "USD",
      storeName: "Mi Tienda",
      paymentMethods: { cash: true, transfer: false },
      salesPageSize: 100,
      onboardingDone: true,
      lockEnabled: true,
      lockHash: "hash",
    });
  });

  it("applies the dark class when the theme changes", async () => {
    const store = await loadStore();
    store.getState().setTheme("dark");
    expect(store.getState().isDark).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    store.getState().setTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("never persists the transient isDark flag or any OAuth token", async () => {
    const store = await loadStore();
    store.getState().setTheme("dark");
    const saved = persisted();
    expect(saved).not.toHaveProperty("isDark");
    expect(JSON.stringify(saved)).not.toMatch(/token/i);
  });

  it("disconnectDriveSync resets sync metadata but keeps the device identity", async () => {
    const store = await loadStore();
    const s = store.getState();
    s.setDriveSyncEnabled(true);
    s.setDriveSyncMeta({ driveFileId: "f1", lastSyncedAt: "2026-01-01", lastSyncedByDeviceName: "Caja" });
    s.setSyncPending(true);
    const deviceId = store.getState().deviceId;

    store.getState().disconnectDriveSync();

    expect(store.getState()).toMatchObject({
      driveSyncEnabled: false,
      driveFileId: null,
      lastSyncedAt: null,
      lastSyncedByDeviceName: null,
      syncPending: false,
      deviceId,
    });
    expect(persisted().driveFileId).toBeNull();
  });

  it("acceptDriveSyncTerms records an ISO timestamp", async () => {
    const store = await loadStore();
    store.getState().acceptDriveSyncTerms();
    const at = store.getState().driveSyncTermsAcceptedAt!;
    expect(new Date(at).toISOString()).toBe(at);
  });
});
