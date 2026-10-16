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

function renderNew() {
  render(
    <ProductFormModal open productId={null} categories={[]} onClose={() => {}} onSaved={() => {}} />
  );
  fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: "Producto QA" } });
}

function field(name: string) {
  return document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
}

describe("<ProductFormModal />", () => {
  beforeEach(() => {
    createProduct.mockReset();
    useSettingsStore.setState({ language: "es" });
  });

  it("BUG-035: a negative initial stock shows a message and is not saved", async () => {
    renderNew();
    fireEvent.change(field("stock"), { target: { value: "-5" } });
    save();
    expect(await screen.findByText("El stock inicial no puede ser negativo")).toBeInTheDocument();
    expect(createProduct).not.toHaveBeenCalled();
  });

  it("BUG-036: a negative purchase price shows a message and is not saved", async () => {
    renderNew();
    fireEvent.change(field("purchase_price"), { target: { value: "-10" } });
    save();
    expect(await screen.findByText("El precio de compra no puede ser negativo")).toBeInTheDocument();
    expect(createProduct).not.toHaveBeenCalled();
  });

  it("saves a product with valid values", async () => {
    renderNew();
    fireEvent.change(field("stock"), { target: { value: "11" } });
    fireEvent.change(field("purchase_price"), { target: { value: "10" } });
    fireEvent.change(field("sell_units.0.sell_price"), { target: { value: "12" } });
    save();
    await waitFor(() => expect(createProduct).toHaveBeenCalledTimes(1));
    expect(createProduct.mock.calls[0][0]).toMatchObject({ name: "Producto QA", stock: 11, purchase_price: 10 });
  });
});
