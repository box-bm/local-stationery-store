import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type FakeDatabase } from "@/test/sqlite";
import type { CartItem, ProductInput, ProductWithUnits } from "@/types";

// db.ts memoizes the connection, so the mock hands out a proxy that always
// forwards to the current test's fresh database.
let current: FakeDatabase;
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: {
    load: async () => ({
      execute: (sql: string, p?: unknown[]) => current.execute(sql, p),
      select: (sql: string, p?: unknown[]) => current.select(sql, p),
    }),
  },
}));

import * as db from "./db";
import { useSettingsStore } from "@/stores/settings";

function input(overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    name: "Papel bond carta",
    category: "Papel",
    barcode: null,
    base_unit_name: "resma",
    base_unit_quantity: 500,
    purchase_price: 40,
    stock: 10,
    min_stock: 2,
    sell_units: [
      { name: "Hoja", quantity_in_base_units: 0.002, sell_price: 0.25, is_default: false },
      { name: "Resma", quantity_in_base_units: 1, sell_price: 55, is_default: true },
    ],
    ...overrides,
  };
}

async function createAndLoad(overrides: Partial<ProductInput> = {}) {
  const id = await db.createProduct(input(overrides));
  return (await db.getProductWithUnits(id))!;
}

function line(p: ProductWithUnits, unitName: string, quantity: number): CartItem {
  const sellUnit = p.sell_units.find((u) => u.name === unitName)!;
  return { product: p, sellUnit, quantity };
}

async function stockOf(id: string) {
  const rows = await current.select<{ stock: number }[]>(
    "SELECT stock FROM products WHERE id = $1",
    [id]
  );
  return rows[0].stock;
}

beforeEach(async () => {
  current = await createTestDb({ seed: false });
  useSettingsStore.getState().setSyncPending(false);
});

describe("products", () => {
  it("createProduct stores the product, its sell units and an initial movement", async () => {
    const p = await createAndLoad();
    expect(p.name).toBe("Papel bond carta");
    expect(p.sell_units.map((u) => u.name).sort()).toEqual(["Hoja", "Resma"]);

    const moves = await db.listStockMovements();
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ type: "purchase", quantity: 10, notes: "Stock inicial" });
  });

  it("createProduct skips the initial movement when stock is 0", async () => {
    await createAndLoad({ stock: 0 });
    expect(await db.listStockMovements()).toHaveLength(0);
  });

  it("guarantees exactly one default sell unit", async () => {
    const p = await createAndLoad({
      sell_units: [
        { name: "A", quantity_in_base_units: 1, sell_price: 1, is_default: false },
        { name: "B", quantity_in_base_units: 2, sell_price: 2, is_default: false },
      ],
    });
    const defaults = p.sell_units.filter((u) => u.is_default === 1);
    expect(defaults.map((u) => u.name)).toEqual(["A"]);
  });

  it("stores an empty barcode as NULL so the UNIQUE constraint isn't hit", async () => {
    await db.createProduct(input({ name: "A", barcode: "" }));
    await db.createProduct(input({ name: "B", barcode: "" }));
    expect(await db.listProducts()).toHaveLength(2);
  });

  it("finds products by barcode", async () => {
    const p = await createAndLoad({ barcode: "7401234567890" });
    const found = await db.getProductByBarcode("7401234567890");
    expect(found?.id).toBe(p.id);
    expect(await db.getProductByBarcode("000")).toBeNull();
  });

  it("updateProduct changes fields and units but never stock", async () => {
    const p = await createAndLoad();
    await db.updateProduct(
      p.id,
      input({
        name: "Papel oficio",
        stock: 999,
        sell_units: [{ name: "Resma", quantity_in_base_units: 1, sell_price: 60, is_default: true }],
      })
    );
    const updated = (await db.getProductWithUnits(p.id))!;
    expect(updated.name).toBe("Papel oficio");
    expect(updated.stock).toBe(10);
    expect(updated.sell_units).toHaveLength(1);
    expect(updated.sell_units[0].sell_price).toBe(60);
  });

  it("deleteProduct cascades to its sell units", async () => {
    const p = await createAndLoad({ stock: 0 });
    await db.deleteProduct(p.id);
    expect(await db.getSellUnits(p.id)).toEqual([]);
  });

  it("searches ignoring accents and case", async () => {
    await createAndLoad({ name: "Lápiz HB" });
    await createAndLoad({ name: "Borrador" });
    const res = await db.searchProductsWithUnits("lapiz");
    expect(res.map((r) => r.name)).toEqual(["Lápiz HB"]);
  });

  it("marks the DB as pending sync after a write", async () => {
    await createAndLoad();
    expect(useSettingsStore.getState().syncPending).toBe(true);
  });
});

describe("stock", () => {
  it("restockProduct adds stock, updates the price and records a movement", async () => {
    const p = await createAndLoad();
    await db.restockProduct(p.id, 5, 42);
    expect(await stockOf(p.id)).toBe(15);
    const [prod] = await db.listProducts();
    expect(prod.purchase_price).toBe(42);
    const moves = await db.listStockMovements();
    expect(moves.find((m) => m.notes === "Reabastecimiento")?.quantity).toBe(5);
  });

  it("restockProduct keeps the price when none is given", async () => {
    const p = await createAndLoad();
    await db.restockProduct(p.id, 1);
    const [prod] = await db.listProducts();
    expect(prod.purchase_price).toBe(40);
  });

  it("adjustStock sets an exact value and records the delta", async () => {
    const p = await createAndLoad();
    await db.adjustStock(p.id, 7, "Conteo físico");
    expect(await stockOf(p.id)).toBe(7);
    const adj = (await db.listStockMovements()).find((m) => m.type === "adjustment");
    expect(adj).toMatchObject({ quantity: -3, notes: "Conteo físico" });
  });

  it("adjustStock is a no-op for an unknown product", async () => {
    await db.adjustStock("missing", 5);
    expect(await db.listStockMovements()).toHaveLength(0);
  });

  it("countStockAlerts classifies low and out-of-stock products", async () => {
    await createAndLoad({ name: "ok", stock: 10, min_stock: 2 });
    await createAndLoad({ name: "low", stock: 1, min_stock: 2 });
    await createAndLoad({ name: "out", stock: 0, min_stock: 2 });
    expect(await db.countStockAlerts()).toEqual({ low: 1, out: 1 });
  });
});

describe("completeSale", () => {
  it("rejects an empty cart", async () => {
    await expect(db.completeSale([], { paymentMethod: "cash" })).rejects.toThrow(
      "El carrito está vacío"
    );
  });

  it("records the sale, items, stock deduction and movements", async () => {
    const p = await createAndLoad();
    const cart = [line(p, "Hoja", 50), line(p, "Resma", 2)];

    const res = await db.completeSale(cart, {
      paymentMethod: "transfer",
      paymentReference: "  ABC123 ",
      notes: "  ",
    });

    // 50 × 0.25 + 2 × 55
    expect(res).toEqual({ saleNumber: 1, total: 122.5 });

    // 10 − (50 × 0.002) − 2 = 7.9 resmas
    expect(await stockOf(p.id)).toBeCloseTo(7.9, 10);

    const [sale] = await db.listSales();
    expect(sale).toMatchObject({
      sale_number: 1,
      total: 122.5,
      payment_method: "transfer",
      payment_reference: "ABC123",
      notes: null,
      customer_id: null,
      item_count: 52,
    });

    const items = await db.getSaleItems(sale.id);
    const hoja = items.find((i) => i.sell_unit_name === "Hoja")!;
    expect(hoja.subtotal).toBeCloseTo(12.5, 10);
    // cost = purchase_price × qty_in_base × quantity = 40 × 0.002 × 50
    expect(hoja.cost_total).toBeCloseTo(4, 10);

    const saleMoves = (await db.listStockMovements()).filter((m) => m.type === "sale");
    expect(saleMoves).toHaveLength(2);
    expect(saleMoves.every((m) => m.reference_id === sale.id)).toBe(true);
    expect(saleMoves.reduce((s, m) => s + m.quantity, 0)).toBeCloseTo(-2.1, 10);
  });

  it("numbers sales sequentially", async () => {
    const p = await createAndLoad();
    const a = await db.completeSale([line(p, "Resma", 1)], { paymentMethod: "cash" });
    const b = await db.completeSale([line(p, "Resma", 1)], { paymentMethod: "cash" });
    expect([a.saleNumber, b.saleNumber]).toEqual([1, 2]);
  });

  it("allows stock to go negative", async () => {
    const p = await createAndLoad({ stock: 1 });
    await db.completeSale([line(p, "Resma", 3)], { paymentMethod: "cash" });
    expect(await stockOf(p.id)).toBe(-2);
  });

  it("finds or creates the customer case-insensitively", async () => {
    const p = await createAndLoad();
    await db.completeSale([line(p, "Resma", 1)], { paymentMethod: "cash", customerName: " María " });
    await db.completeSale([line(p, "Resma", 1)], { paymentMethod: "cash", customerName: "maría" });

    const customers = await db.listCustomersWithCounts();
    expect(customers).toHaveLength(1);
    expect(customers[0]).toMatchObject({ name: "María", sale_count: 2 });
  });
});

describe("customers", () => {
  it("searchCustomers matches without accents and respects the limit", async () => {
    for (const n of ["José", "Josefina", "Ana"]) await db.findOrCreateCustomer(n);
    // NOCASE collation only folds ASCII, so the order of accented names isn't asserted.
    const found = (await db.searchCustomers("jose")).map((c) => c.name);
    expect(found).toHaveLength(2);
    expect(found).toEqual(expect.arrayContaining(["José", "Josefina"]));
    expect(await db.searchCustomers("", 2)).toHaveLength(2);
  });

  it("deleteCustomer unlinks past sales but keeps the name snapshot", async () => {
    const p = await createAndLoad();
    await db.completeSale([line(p, "Resma", 1)], { paymentMethod: "cash", customerName: "Luis" });
    const [c] = await db.listCustomersWithCounts();
    await db.deleteCustomer(c.id);
    const [sale] = await db.listSales();
    expect(sale.customer_id).toBeNull();
    expect(sale.customer_name).toBe("Luis");
  });

  it("mergeCustomers moves sales to the target and deletes the rest", async () => {
    const p = await createAndLoad();
    for (const n of ["Luis", "Luis P.", "Ana"]) {
      await db.completeSale([line(p, "Resma", 1)], { paymentMethod: "cash", customerName: n });
    }
    const all = await db.listCustomersWithCounts();
    const target = all.find((c) => c.name === "Luis")!;
    const other = all.find((c) => c.name === "Luis P.")!;
    await db.mergeCustomers([target.id, other.id], target.id);

    const after = await db.listCustomersWithCounts();
    expect(after.map((c) => [c.name, c.sale_count])).toEqual([
      ["Ana", 1],
      ["Luis", 2],
    ]);
  });

  it("renameCustomer trims the new name", async () => {
    const c = await db.findOrCreateCustomer("Pedro");
    await db.renameCustomer(c.id, "  Pedro Pérez ");
    const [row] = await db.listCustomersWithCounts();
    expect(row.name).toBe("Pedro Pérez");
  });
});

describe("categories", () => {
  it("lists, renames, merges and deletes categories", async () => {
    await createAndLoad({ name: "A", category: "Papel" });
    await createAndLoad({ name: "B", category: "papeleria" });
    await createAndLoad({ name: "C", category: "Arte" });

    expect(await db.listCategories()).toEqual(expect.arrayContaining(["Papel", "papeleria", "Arte"]));

    await db.mergeCategories(["Papel", "papeleria"], "Papelería");
    let counts = await db.listCategoriesWithCounts();
    expect(counts.find((c) => c.category === "Papelería")?.count).toBe(2);

    await db.renameCategory("Arte", "Manualidades");
    await db.deleteCategory("Papelería");
    counts = await db.listCategoriesWithCounts();
    expect(counts).toEqual([{ category: "Manualidades", count: 1 }]);
  });
});

describe("sales reports", () => {
  async function saleAt(p: ProductWithUnits, createdAt: string, qty = 1) {
    await db.completeSale([line(p, "Resma", qty)], { paymentMethod: "cash" });
    await current.execute(
      "UPDATE sales SET created_at = $1 WHERE sale_number = (SELECT MAX(sale_number) FROM sales)",
      [createdAt]
    );
  }

  it("filters by an inclusive date range and paginates", async () => {
    const p = await createAndLoad();
    await saleAt(p, "2026-01-10 10:00:00");
    await saleAt(p, "2026-01-15 23:30:00");
    await saleAt(p, "2026-01-20 09:00:00");

    const range = { from: "2026-01-10", to: "2026-01-15" };
    expect(await db.countSales(range)).toBe(2);
    expect(await db.countSales()).toBe(3);

    const page1 = await db.listSales(undefined, { limit: 2, offset: 0 });
    const page2 = await db.listSales(undefined, { limit: 2, offset: 2 });
    expect(page1.map((s) => s.sale_number)).toEqual([3, 2]);
    expect(page2.map((s) => s.sale_number)).toEqual([1]);
  });

  it("getSalesSummary computes total and profit", async () => {
    const p = await createAndLoad(); // purchase 40, sells at 55 per ream
    await saleAt(p, "2026-02-01 10:00:00", 2);
    expect(await db.getSalesSummary()).toEqual({ count: 1, total: 110, profit: 30 });
    expect(await db.getSalesSummary({ from: "2026-03-01" })).toEqual({
      count: 0,
      total: 0,
      profit: 0,
    });
  });

  it("getSalesSegments groups by month, most recent first", async () => {
    const p = await createAndLoad();
    await saleAt(p, "2026-01-05 10:00:00");
    await saleAt(p, "2026-01-25 10:00:00");
    await saleAt(p, "2026-02-03 10:00:00");
    const segs = await db.getSalesSegments(undefined, "month");
    expect(segs).toEqual([
      { period: "2026-02", count: 1, total: 55, profit: 15 },
      { period: "2026-01", count: 2, total: 110, profit: 30 },
    ]);
  });

  it("listStockMovements filters by date on the movement, not the product", async () => {
    const p = await createAndLoad();
    await current.execute("UPDATE stock_movements SET created_at = '2025-12-01 00:00:00'");
    await db.restockProduct(p.id, 1);
    const moves = await db.listStockMovements({ from: "2026-01-01" });
    expect(moves).toHaveLength(1);
    expect(moves[0].product_name).toBe("Papel bond carta");
  });
});
