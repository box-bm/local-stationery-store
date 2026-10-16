import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { ProductWithUnits } from "@/types";

function product(overrides: Partial<ProductWithUnits>): ProductWithUnits {
  return {
    id: "1",
    name: "Producto",
    description: null,
    barcode: null,
    category: "Útiles",
    base_unit_name: "unidad",
    base_unit_quantity: 1,
    purchase_price: 1,
    stock: 10,
    min_stock: 1,
    created_at: "",
    updated_at: "",
    sell_units: [],
    ...overrides,
  };
}

const borrador = product({
  id: "5",
  name: "Borrador blanco",
  barcode: "7502000000027",
  stock: 0,
  sell_units: [
    { id: "51", product_id: "5", name: "Unidad", quantity_in_base_units: 1, sell_price: 1.5, is_default: 1, created_at: "" },
  ],
});
const tijera = product({
  id: "7",
  name: "Tijera escolar",
  barcode: "7502000000041",
  stock: 4,
  sell_units: [
    { id: "71", product_id: "7", name: "Unidad", quantity_in_base_units: 1, sell_price: 12, is_default: 1, created_at: "" },
  ],
});
const catalog = [borrador, tijera];

vi.mock("@/services/db", () => ({
  searchProductsWithUnits: vi.fn(async () => catalog),
  getProductByBarcode: vi.fn(async (code: string) => catalog.find((p) => p.barcode === code) ?? null),
  listCategories: vi.fn(async () => []),
  getSalesSummary: vi.fn(async () => ({ count: 0, total: 0, profit: 0 })),
  countStockAlerts: vi.fn(async () => ({ low: 0, out: 1 })),
  searchCustomers: vi.fn(async () => []),
  completeSale: vi.fn(),
}));

import { POSScreen } from "./POSScreen";
import { useCartStore } from "@/stores/cart";
import { useSettingsStore } from "@/stores/settings";
import { useToastStore } from "@/stores/toast";

/** Simulate a USB scanner: characters typed back-to-back, then Enter. */
function scan(code: string) {
  act(() => {
    for (const ch of code) fireEvent.keyDown(window, { key: ch });
    fireEvent.keyDown(window, { key: "Enter" });
  });
}

function toastMessages() {
  return useToastStore.getState().toasts.map((t) => t.message);
}

describe("<POSScreen />", () => {
  beforeEach(() => {
    useCartStore.setState({ items: [] });
    useToastStore.setState({ toasts: [] });
    useSettingsStore.getState().setLanguage("es");
    useSettingsStore.getState().setCurrency("Q", "GTQ");
  });

  it("adds an in-stock product when its barcode is scanned", async () => {
    render(<POSScreen />);
    await screen.findByText("Tijera escolar");
    scan("7502000000041");
    await waitFor(() => expect(useCartStore.getState().items).toHaveLength(1));
  });

  // H-04 (S3-HA-001): scanning an out-of-stock product must behave like
  // clicking its card — blocked, with the same message.
  it("H-04: does not add an out-of-stock product when its barcode is scanned", async () => {
    render(<POSScreen />);
    await screen.findByText("Borrador blanco");
    scan("7502000000027");
    await waitFor(() =>
      expect(toastMessages()).toContain(
        "Borrador blanco no tiene stock disponible. Reabastecé antes de venderlo."
      )
    );
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("H-04: scanning past the remaining stock doesn't grow the cart", async () => {
    useCartStore.getState().addItem(tijera, tijera.sell_units[0], 4);
    render(<POSScreen />);
    await screen.findByText("Tijera escolar");
    scan("7502000000041");
    await waitFor(() =>
      expect(toastMessages()).toContain("Tijera escolar: no hay stock suficiente.")
    );
    expect(useCartStore.getState().items[0].quantity).toBe(4);
  });

  // H-07 (S3-HA-001): after adding to the cart, focus returns to the search
  // box so the cashier can keep scanning/typing without the mouse.
  // Regression guard only: jsdom doesn't run Radix's restore-focus-to-trigger
  // step, so this also passed before the fix. The failing-first evidence is
  // the Cypress spec (e2e/specs/pos/99-hallazgos.cy.ts, H-07) in a real browser.
  it("H-07: returns focus to the search box after adding to the cart", async () => {
    render(<POSScreen />);
    const card = (await screen.findByText("Tijera escolar")).closest("button")!;
    card.focus(); // a real click focuses the card, which opens the dialog
    fireEvent.click(card);
    fireEvent.click(await screen.findByRole("button", { name: "Agregar al carrito" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // Radix restores focus to the trigger on a timer after unmounting.
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(document.activeElement).toBe(
      screen.getByPlaceholderText("Buscar producto por nombre o escanear código de barras…")
    );
  });
});
