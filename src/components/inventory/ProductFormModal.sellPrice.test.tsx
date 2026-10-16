import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useSettingsStore } from "@/stores/settings";

const createProduct = vi.fn();
vi.mock("@/services/db", () => ({
  createProduct: (...args: unknown[]) => createProduct(...args),
  updateProduct: vi.fn(),
  getProductWithUnits: vi.fn(),
}));

import { ProductFormModal } from "./ProductFormModal";

function sellPrice() {
  return document.querySelector<HTMLInputElement>('input[name="sell_units.0.sell_price"]')!;
}

// BUG-037: the form must not create sell units priced at Q0.00.
describe("<ProductFormModal /> — sell price", () => {
  beforeEach(() => {
    createProduct.mockReset();
    useSettingsStore.setState({ language: "es" });
    render(
      <ProductFormModal open productId={null} categories={[]} onClose={() => {}} onSaved={() => {}} />
    );
    fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: "Producto QA" } });
  });

  it("BUG-037: a sell price of Q0.00 shows a message and is not saved", async () => {
    fireEvent.change(sellPrice(), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("El precio de venta debe ser mayor que 0")).toBeInTheDocument();
    expect(createProduct).not.toHaveBeenCalled();
  });

  it("saves when the sell price is greater than zero", async () => {
    fireEvent.change(sellPrice(), { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(createProduct).toHaveBeenCalledTimes(1));
    expect(createProduct.mock.calls[0][0].sell_units[0].sell_price).toBe(2.5);
  });
});
