import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore } from "./cart";
import type { Product, SellUnit } from "@/types";

function product(id: number, name = `P${id}`): Product {
  return {
    id: String(id),
    name,
    description: null,
    barcode: null,
    category: null,
    base_unit_name: "unidad",
    base_unit_quantity: 1,
    purchase_price: 0,
    stock: 100,
    min_stock: 0,
    created_at: "",
    updated_at: "",
  };
}

function unit(id: number, price: number, qtyBase = 1): SellUnit {
  return {
    id: String(id),
    product_id: "1",
    name: `U${id}`,
    quantity_in_base_units: qtyBase,
    sell_price: price,
    is_default: 1,
    created_at: "",
  };
}

describe("cart store", () => {
  beforeEach(() => {
    useCartStore.setState({ items: [] });
  });

  it("adds an item and computes total + count", () => {
    const s = useCartStore.getState();
    s.addItem(product(1), unit(1, 2.5), 2);
    const st = useCartStore.getState();
    expect(st.items).toHaveLength(1);
    expect(st.total()).toBe(5);
    expect(st.count()).toBe(2);
  });

  it("merges quantity for the same product + sell unit", () => {
    const s = useCartStore.getState();
    s.addItem(product(1), unit(1, 2), 1);
    s.addItem(product(1), unit(1, 2), 3);
    const st = useCartStore.getState();
    expect(st.items).toHaveLength(1);
    expect(st.items[0].quantity).toBe(4);
  });

  it("keeps separate lines for different sell units", () => {
    const s = useCartStore.getState();
    s.addItem(product(1), unit(1, 2), 1);
    s.addItem(product(1), unit(2, 5), 1);
    expect(useCartStore.getState().items).toHaveLength(2);
  });

  it("removes a line when quantity drops to 0", () => {
    const s = useCartStore.getState();
    s.addItem(product(1), unit(1, 2), 1);
    s.updateQuantity(0, 0);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("removeItem and clear empty the cart", () => {
    const s = useCartStore.getState();
    s.addItem(product(1), unit(1, 2), 1);
    s.addItem(product(2), unit(3, 4), 1);
    s.removeItem(0);
    expect(useCartStore.getState().items).toHaveLength(1);
    useCartStore.getState().clear();
    expect(useCartStore.getState().items).toHaveLength(0);
  });
});

// Reproduce QA findings H-01 / H-02 (S3-HA-001): the cart must never hold more
// base units of a product than its stock.
describe("cart store — stock limit", () => {
  // "Tijera escolar": stock 4 units; sold per unit or as a pair (2 units).
  const tijera = { ...product(7, "Tijera escolar"), stock: 4 };
  const porUnidad = unit(71, 12, 1);
  const par = unit(72, 22, 2);

  beforeEach(() => {
    useCartStore.setState({ items: [] });
  });

  it("H-01: «+» past the available stock leaves the quantity unchanged", () => {
    const s = useCartStore.getState();
    expect(s.addItem(tijera, porUnidad, 4)).toBe(true);
    expect(s.updateQuantity(0, 5)).toBe(false);
    expect(useCartStore.getState().items[0].quantity).toBe(4);
  });

  it("H-01: decreasing the quantity is always allowed", () => {
    const s = useCartStore.getState();
    s.addItem(tijera, porUnidad, 4);
    expect(s.updateQuantity(0, 3)).toBe(true);
    expect(useCartStore.getState().items[0].quantity).toBe(3);
  });

  it("H-02: adding the same product twice cannot exceed the stock", () => {
    const s = useCartStore.getState();
    expect(s.addItem(tijera, porUnidad, 3)).toBe(true);
    expect(s.addItem(tijera, porUnidad, 3)).toBe(false);
    expect(useCartStore.getState().items[0].quantity).toBe(3);
  });

  it("H-02: the limit counts every sell unit of the same product", () => {
    const s = useCartStore.getState();
    s.addItem(tijera, porUnidad, 3); // 3 base units reserved
    expect(s.addItem(tijera, par, 1)).toBe(false); // +2 → 5 > 4
    expect(s.addItem(tijera, porUnidad, 1)).toBe(true); // exactly 4
    expect(useCartStore.getState().count()).toBe(4);
  });

  it("H-02: fractional sell units don't trip on floating-point error", () => {
    const resma = { ...product(8, "Papel"), stock: 1 };
    const hoja = unit(81, 0.25, 0.002);
    const s = useCartStore.getState();
    expect(s.addItem(resma, hoja, 300)).toBe(true);
    expect(s.addItem(resma, hoja, 200)).toBe(true); // 500 × 0.002 = 1
    expect(s.addItem(resma, hoja, 1)).toBe(false);
  });
});
