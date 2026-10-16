import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SellUnitModal } from "./SellUnitModal";
import { useSettingsStore } from "@/stores/settings";
import type { ProductWithUnits } from "@/types";

const tijera: ProductWithUnits = {
  id: "7",
  name: "Tijera escolar",
  description: null,
  barcode: null,
  category: "Útiles",
  base_unit_name: "unidad",
  base_unit_quantity: 1,
  purchase_price: 6,
  stock: 4,
  min_stock: 1,
  created_at: "",
  updated_at: "",
  sell_units: [
    { id: "71", product_id: "7", name: "Unidad", quantity_in_base_units: 1, sell_price: 12, is_default: 1, created_at: "" },
    { id: "72", product_id: "7", name: "Par", quantity_in_base_units: 2, sell_price: 22, is_default: 0, created_at: "" },
  ],
};

function renderModal(reserved: number) {
  const confirmed: number[] = [];
  render(
    <SellUnitModal
      product={tijera}
      open
      reserved={reserved}
      onClose={() => {}}
      onConfirm={(_, qty) => confirmed.push(qty)}
    />
  );
  return confirmed;
}

describe("<SellUnitModal />", () => {
  beforeEach(() => {
    useSettingsStore.getState().setLanguage("es");
    useSettingsStore.getState().setCurrency("GTQ");
  });

  it("allows adding up to the full stock when nothing is in the cart", () => {
    const confirmed = renderModal(0);
    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "4" } });
    const add = screen.getByRole("button", { name: "Agregar al carrito" });
    expect(add).toBeEnabled();
    fireEvent.click(add);
    expect(confirmed).toEqual([4]);
  });

  // H-02 (S3-HA-001): 3 units already in the cart + 3 more > stock 4.
  it("H-02: blocks adding when the cart already reserves part of the stock", () => {
    const confirmed = renderModal(3);
    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "3" } });
    const add = screen.getByRole("button", { name: "Agregar al carrito" });
    expect(add).toBeDisabled();
    expect(screen.getByText("No hay stock suficiente para esta cantidad.")).toBeInTheDocument();
    fireEvent.click(add);
    expect(confirmed).toEqual([]);
  });

  it("H-02: still allows the remaining stock", () => {
    renderModal(3);
    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "1" } });
    expect(screen.getByRole("button", { name: "Agregar al carrito" })).toBeEnabled();
  });
});
