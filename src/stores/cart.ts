import { create } from "zustand";
import { cartTotal, cartProfit, stockDeducted } from "@/lib/calc";
import { fitsInStock, reservedStock } from "@/lib/stock";
import type { CartItem, Product, SellUnit } from "@/types";

interface CartState {
  items: CartItem[];
  /** Returns false (and leaves the cart unchanged) if it would exceed the stock. */
  addItem: (product: Product, sellUnit: SellUnit, quantity: number) => boolean;
  removeItem: (index: number) => void;
  /** Returns false (and leaves the cart unchanged) if it would exceed the stock. */
  updateQuantity: (index: number, quantity: number) => boolean;
  /** Whether line `index` can grow by one more sell unit without exceeding the stock. */
  canIncrease: (index: number) => boolean;
  clear: () => void;
  total: () => number;
  profit: () => number;
  count: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (product, sellUnit, quantity) => {
    const { items } = get();
    // Stock is shared by every sell unit of the product, so count all its lines.
    const needed =
      reservedStock(items, product.id) +
      stockDeducted(sellUnit.quantity_in_base_units, quantity);
    if (!fitsInStock(needed, product.stock)) return false;

    // Merge with an existing line for the same product + sell unit.
    const idx = items.findIndex(
      (it) => it.product.id === product.id && it.sellUnit.id === sellUnit.id
    );
    if (idx >= 0) {
      const next = [...items];
      next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
      set({ items: next });
    } else {
      set({ items: [...items, { product, sellUnit, quantity }] });
    }
    return true;
  },

  removeItem: (index) =>
    set((state) => ({ items: state.items.filter((_, i) => i !== index) })),

  updateQuantity: (index, quantity) => {
    const { items } = get();
    if (quantity <= 0) {
      set({ items: items.filter((_, i) => i !== index) });
      return true;
    }
    const line = items[index];
    if (!line) return false;
    // Only growing a line can overshoot the stock; shrinking is always allowed.
    if (quantity > line.quantity) {
      const needed =
        reservedStock(items, line.product.id, index) +
        stockDeducted(line.sellUnit.quantity_in_base_units, quantity);
      if (!fitsInStock(needed, line.product.stock)) return false;
    }
    const next = [...items];
    next[index] = { ...line, quantity };
    set({ items: next });
    return true;
  },

  canIncrease: (index) => {
    const { items } = get();
    const line = items[index];
    if (!line) return false;
    const needed =
      reservedStock(items, line.product.id) +
      line.sellUnit.quantity_in_base_units;
    return fitsInStock(needed, line.product.stock);
  },

  clear: () => set({ items: [] }),

  total: () => cartTotal(get().items),

  profit: () => cartProfit(get().items),

  count: () => get().items.reduce((sum, it) => sum + it.quantity, 0),
}));
