import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore } from "./cart";
import type { Product, SellUnit } from "@/types";

function product(id: number, name = `P${id}`): Product {
  return {
    id,
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
    id,
    product_id: 1,
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
