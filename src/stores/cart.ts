import { create } from "zustand";
import { cartTotal } from "@/lib/calc";
import type { CartItem, Product, SellUnit } from "@/types";

interface CartState {
  items: CartItem[];
  addItem: (product: Product, sellUnit: SellUnit, quantity: number) => void;
  removeItem: (index: number) => void;
  updateQuantity: (index: number, quantity: number) => void;
  clear: () => void;
  total: () => number;
  count: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (product, sellUnit, quantity) =>
    set((state) => {
      // Merge with an existing line for the same product + sell unit.
      const idx = state.items.findIndex(
        (it) => it.product.id === product.id && it.sellUnit.id === sellUnit.id
      );
      if (idx >= 0) {
        const items = [...state.items];
        items[idx] = {
          ...items[idx],
          quantity: items[idx].quantity + quantity,
        };
        return { items };
      }
      return { items: [...state.items, { product, sellUnit, quantity }] };
    }),

  removeItem: (index) =>
    set((state) => ({ items: state.items.filter((_, i) => i !== index) })),

  updateQuantity: (index, quantity) =>
    set((state) => {
      if (quantity <= 0) {
        return { items: state.items.filter((_, i) => i !== index) };
      }
      const items = [...state.items];
      items[index] = { ...items[index], quantity };
      return { items };
    }),

  clear: () => set({ items: [] }),

  total: () => cartTotal(get().items),

  count: () => get().items.reduce((sum, it) => sum + it.quantity, 0),
}));
