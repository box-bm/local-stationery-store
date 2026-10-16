import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Tauri-backed services and the sync/catalog sections aren't needed for the
// General tab.
vi.mock("@/services/system", () => ({
  getDataDir: vi.fn(async () => "/data"),
  openDataFolder: vi.fn(),
  backupDatabase: vi.fn(),
  restoreDatabase: vi.fn(),
}));
vi.mock("@/services/excel", () => ({
  exportInventory: vi.fn(),
  exportSales: vi.fn(),
  exportStockMovements: vi.fn(),
  exportGeneral: vi.fn(),
}));
vi.mock("@/services/updater", () => ({
  currentVersion: vi.fn(async () => "0.0.0"),
  checkForUpdate: vi.fn(),
  installUpdate: vi.fn(),
}));
vi.mock("./CatalogManager", () => ({ CatalogManager: () => null }));
vi.mock("./DriveSyncSection", () => ({ DriveSyncSection: () => null }));

import { SettingsScreen } from "./SettingsScreen";
import { useSettingsStore } from "@/stores/settings";

describe("<SettingsScreen /> — General", () => {
  beforeEach(() => {
    const s = useSettingsStore.getState();
    s.setLanguage("es");
    s.setCurrency("GTQ");
    s.setStoreName("Mi Librería");
  });

  it("BUG-043: the currency is chosen from a list, not typed", () => {
    render(<SettingsScreen onShowGuide={() => {}} />);
    expect(screen.queryByLabelText("Símbolo")).toBeNull();
    const currency = screen.getByLabelText("Moneda") as HTMLSelectElement;
    expect(currency.tagName).toBe("SELECT");
    expect(currency.value).toBe("GTQ");

    fireEvent.change(currency, { target: { value: "HNL" } });
    expect(useSettingsStore.getState()).toMatchObject({ currencySymbol: "L", currencyCode: "HNL" });
  });

  it("BUG-044: an empty business name shows a message and is not saved", () => {
    render(<SettingsScreen onShowGuide={() => {}} />);
    const name = screen.getByLabelText("Nombre del negocio");
    fireEvent.change(name, { target: { value: "  " } });
    fireEvent.blur(name);
    expect(screen.getByText("El nombre del negocio es obligatorio.")).toBeInTheDocument();
    expect(useSettingsStore.getState().storeName).toBe("Mi Librería");

    fireEvent.change(name, { target: { value: "Librería Central" } });
    fireEvent.blur(name);
    expect(screen.queryByText("El nombre del negocio es obligatorio.")).toBeNull();
    expect(useSettingsStore.getState().storeName).toBe("Librería Central");
  });
});
