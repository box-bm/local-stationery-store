// Centralized stock status logic so POS, Inventory and the sidebar all agree.

export type StockStatus = "ok" | "low" | "out";

export interface StockCounts {
  low: number;
  out: number;
}

/**
 * Classify a product's stock:
 * - "out"  → no stock left (error)        stock <= 0
 * - "low"  → too little stock (warning)   0 < stock <= min_stock
 * - "ok"   → healthy
 */
export function stockStatus(stock: number, minStock: number): StockStatus {
  if (stock <= 0) return "out";
  if (stock <= minStock) return "low";
  return "ok";
}

/** Severity mapping → which UI variant/color to use. */
export const STOCK_SEVERITY: Record<StockStatus, "error" | "warning" | "ok"> = {
  out: "error",
  low: "warning",
  ok: "ok",
};

/** Tally a list of products into low/out counts. */
export function countStock(
  products: { stock: number; min_stock: number }[]
): StockCounts {
  let low = 0;
  let out = 0;
  for (const p of products) {
    const s = stockStatus(p.stock, p.min_stock);
    if (s === "out") out++;
    else if (s === "low") low++;
  }
  return { low, out };
}
