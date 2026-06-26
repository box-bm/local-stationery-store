import Database from "@tauri-apps/plugin-sql";
import { cartTotal, lineSubtotal, stockDeducted } from "@/lib/calc";
import { countStock, type StockCounts } from "@/lib/stock";
import type {
  Product,
  ProductInput,
  ProductWithUnits,
  Sale,
  SaleItem,
  SaleWithItems,
  SellUnit,
  StockMovement,
  CartItem,
  Customer,
} from "@/types";

const DB_URL = "sqlite:libreria.db";

let dbPromise: Promise<Database> | null = null;

/** Lazily open (and memoize) the database connection. */
export async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL).then(async (db) => {
      // Enforce foreign keys / cascades on this connection.
      await db.execute("PRAGMA foreign_keys = ON;");
      return db;
    });
  }
  return dbPromise;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function listProducts(search?: string): Promise<Product[]> {
  const db = await getDb();
  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    return db.select<Product[]>(
      `SELECT * FROM products
       WHERE name LIKE $1 OR barcode LIKE $1 OR category LIKE $1
       ORDER BY name COLLATE NOCASE`,
      [q]
    );
  }
  return db.select<Product[]>(
    "SELECT * FROM products ORDER BY name COLLATE NOCASE"
  );
}

export async function getSellUnits(productId: number): Promise<SellUnit[]> {
  const db = await getDb();
  return db.select<SellUnit[]>(
    "SELECT * FROM sell_units WHERE product_id = $1 ORDER BY quantity_in_base_units",
    [productId]
  );
}

export async function getProductWithUnits(
  id: number
): Promise<ProductWithUnits | null> {
  const db = await getDb();
  const rows = await db.select<Product[]>(
    "SELECT * FROM products WHERE id = $1",
    [id]
  );
  if (!rows.length) return null;
  const sell_units = await getSellUnits(id);
  return { ...rows[0], sell_units };
}

export async function getProductByBarcode(
  barcode: string
): Promise<ProductWithUnits | null> {
  const db = await getDb();
  const rows = await db.select<Product[]>(
    "SELECT * FROM products WHERE barcode = $1",
    [barcode]
  );
  if (!rows.length) return null;
  const sell_units = await getSellUnits(rows[0].id);
  return { ...rows[0], sell_units };
}

/** Search products (with units) by name/barcode/category for the POS autocomplete. */
export async function searchProductsWithUnits(
  search: string,
  limit = 12
): Promise<ProductWithUnits[]> {
  const db = await getDb();
  const q = `%${search.trim()}%`;
  const products = await db.select<Product[]>(
    `SELECT * FROM products
     WHERE name LIKE $1 OR barcode LIKE $1 OR category LIKE $1
     ORDER BY name COLLATE NOCASE
     LIMIT $2`,
    [q, limit]
  );
  const result: ProductWithUnits[] = [];
  for (const p of products) {
    result.push({ ...p, sell_units: await getSellUnits(p.id) });
  }
  return result;
}

export async function listCategories(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<{ category: string }[]>(
    "SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category <> '' ORDER BY category"
  );
  return rows.map((r) => r.category);
}

/** Insert a product plus its sell units; records an initial purchase movement. */
export async function createProduct(input: ProductInput): Promise<number> {
  const db = await getDb();
  const res = await db.execute(
    `INSERT INTO products
       (name, description, barcode, category, base_unit_name, base_unit_quantity, purchase_price, stock, min_stock)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      input.name,
      input.description ?? null,
      input.barcode || null,
      input.category ?? null,
      input.base_unit_name,
      input.base_unit_quantity,
      input.purchase_price,
      input.stock,
      input.min_stock,
    ]
  );
  const productId = res.lastInsertId as number;

  await replaceSellUnits(productId, input.sell_units);

  if (input.stock > 0) {
    await db.execute(
      `INSERT INTO stock_movements (product_id, type, quantity, notes)
       VALUES ($1, 'purchase', $2, $3)`,
      [productId, input.stock, "Stock inicial"]
    );
  }
  return productId;
}

/** Update a product's fields and replace its sell units. Does NOT change stock. */
export async function updateProduct(
  id: number,
  input: ProductInput
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE products SET
       name = $1, description = $2, barcode = $3, category = $4,
       base_unit_name = $5, base_unit_quantity = $6, purchase_price = $7,
       min_stock = $8, updated_at = CURRENT_TIMESTAMP
     WHERE id = $9`,
    [
      input.name,
      input.description ?? null,
      input.barcode || null,
      input.category ?? null,
      input.base_unit_name,
      input.base_unit_quantity,
      input.purchase_price,
      input.min_stock,
      id,
    ]
  );
  await replaceSellUnits(id, input.sell_units);
}

/** Delete + reinsert sell units for a product (simplest reliable sync). */
async function replaceSellUnits(
  productId: number,
  units: ProductInput["sell_units"]
): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM sell_units WHERE product_id = $1", [productId]);

  // Guarantee exactly one default.
  const hasDefault = units.some((u) => u.is_default);
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const isDefault = u.is_default || (!hasDefault && i === 0) ? 1 : 0;
    await db.execute(
      `INSERT INTO sell_units (product_id, name, quantity_in_base_units, sell_price, is_default)
       VALUES ($1,$2,$3,$4,$5)`,
      [productId, u.name, u.quantity_in_base_units, u.sell_price, isDefault]
    );
  }
}

/** Add stock (a restock / purchase). Records a movement. */
export async function restockProduct(
  productId: number,
  quantityBaseUnits: number,
  purchasePrice?: number,
  notes?: string
): Promise<void> {
  const db = await getDb();
  if (purchasePrice != null) {
    await db.execute(
      "UPDATE products SET stock = stock + $1, purchase_price = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
      [quantityBaseUnits, purchasePrice, productId]
    );
  } else {
    await db.execute(
      "UPDATE products SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [quantityBaseUnits, productId]
    );
  }
  await db.execute(
    `INSERT INTO stock_movements (product_id, type, quantity, notes)
     VALUES ($1, 'purchase', $2, $3)`,
    [productId, quantityBaseUnits, notes ?? "Reabastecimiento"]
  );
}

/** Manually set stock to an exact value, recording an adjustment movement. */
export async function adjustStock(
  productId: number,
  newStock: number,
  notes?: string
): Promise<void> {
  const db = await getDb();
  const rows = await db.select<{ stock: number }[]>(
    "SELECT stock FROM products WHERE id = $1",
    [productId]
  );
  if (!rows.length) return;
  const delta = newStock - rows[0].stock;
  await db.execute(
    "UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
    [newStock, productId]
  );
  await db.execute(
    `INSERT INTO stock_movements (product_id, type, quantity, notes)
     VALUES ($1, 'adjustment', $2, $3)`,
    [productId, delta, notes ?? "Ajuste manual de inventario"]
  );
}

export async function deleteProduct(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM products WHERE id = $1", [id]);
}

/** Centralized stock alert counts: low (warning) and out (error). */
export async function countStockAlerts(): Promise<StockCounts> {
  const db = await getDb();
  const rows = await db.select<{ stock: number; min_stock: number }[]>(
    "SELECT stock, min_stock FROM products"
  );
  return countStock(rows);
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export async function searchCustomers(
  search: string,
  limit = 8
): Promise<Customer[]> {
  const db = await getDb();
  const q = `%${search.trim()}%`;
  return db.select<Customer[]>(
    "SELECT * FROM customers WHERE name LIKE $1 ORDER BY name COLLATE NOCASE LIMIT $2",
    [q, limit]
  );
}

/** Find a customer by exact (case-insensitive) name, or create one. */
export async function findOrCreateCustomer(name: string): Promise<Customer> {
  const db = await getDb();
  const trimmed = name.trim();
  const existing = await db.select<Customer[]>(
    "SELECT * FROM customers WHERE name = $1 COLLATE NOCASE LIMIT 1",
    [trimmed]
  );
  if (existing.length) return existing[0];
  const res = await db.execute("INSERT INTO customers (name) VALUES ($1)", [
    trimmed,
  ]);
  return { id: res.lastInsertId as number, name: trimmed, created_at: "" };
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export interface CompleteSaleResult {
  saleId: number;
  total: number;
}

export interface SaleMeta {
  paymentMethod: string;
  paymentReference?: string | null;
  customerName?: string | null;
  notes?: string | null;
}

/**
 * Persist a completed sale: insert the sale + line items, deduct stock, and
 * record one stock movement per line. Stock deduction follows the simplified
 * rule: deduct `quantity_in_base_units * quantity` from product stock.
 */
export async function completeSale(
  cart: CartItem[],
  meta: SaleMeta
): Promise<CompleteSaleResult> {
  if (!cart.length) throw new Error("El carrito está vacío");
  const db = await getDb();

  const total = cartTotal(cart);

  // Resolve (find or create) the customer if a name was given.
  let customerId: number | null = null;
  let customerName: string | null = null;
  if (meta.customerName && meta.customerName.trim()) {
    const customer = await findOrCreateCustomer(meta.customerName);
    customerId = customer.id;
    customerName = customer.name;
  }

  const saleRes = await db.execute(
    `INSERT INTO sales
       (total, payment_method, payment_reference, customer_id, customer_name, notes)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      total,
      meta.paymentMethod,
      meta.paymentReference?.trim() || null,
      customerId,
      customerName,
      meta.notes?.trim() || null,
    ]
  );
  const saleId = saleRes.lastInsertId as number;

  for (const item of cart) {
    const subtotal = lineSubtotal(item.sellUnit.sell_price, item.quantity);
    await db.execute(
      `INSERT INTO sale_items
         (sale_id, product_id, sell_unit_id, product_name, sell_unit_name, quantity, unit_price, subtotal)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        saleId,
        item.product.id,
        item.sellUnit.id,
        item.product.name,
        item.sellUnit.name,
        item.quantity,
        item.sellUnit.sell_price,
        subtotal,
      ]
    );

    const deducted = stockDeducted(
      item.sellUnit.quantity_in_base_units,
      item.quantity
    );
    await db.execute(
      "UPDATE products SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [deducted, item.product.id]
    );
    await db.execute(
      `INSERT INTO stock_movements (product_id, type, quantity, reference_id, notes)
       VALUES ($1, 'sale', $2, $3, $4)`,
      [
        item.product.id,
        -deducted,
        saleId,
        `Venta #${saleId}: ${item.quantity} x ${item.sellUnit.name}`,
      ]
    );
  }

  return { saleId, total };
}

export interface DateRange {
  from?: string; // ISO date (inclusive)
  to?: string; // ISO date (inclusive)
}

function dateWhere(range?: DateRange): { clause: string; params: string[] } {
  const params: string[] = [];
  const parts: string[] = [];
  if (range?.from) {
    params.push(range.from);
    parts.push(`created_at >= $${params.length}`);
  }
  if (range?.to) {
    // Include the whole "to" day.
    params.push(range.to + " 23:59:59");
    parts.push(`created_at <= $${params.length}`);
  }
  return {
    clause: parts.length ? `WHERE ${parts.join(" AND ")}` : "",
    params,
  };
}

export async function listSales(range?: DateRange): Promise<SaleWithItems[]> {
  const db = await getDb();
  const { clause, params } = dateWhere(range);
  const sales = await db.select<(Sale & { item_count: number })[]>(
    `SELECT s.*, COALESCE(SUM(si.quantity), 0) AS item_count
     FROM sales s
     LEFT JOIN sale_items si ON si.sale_id = s.id
     ${clause}
     GROUP BY s.id
     ORDER BY s.created_at DESC`,
    params
  );
  return sales.map((s) => ({ ...s, items: [], item_count: s.item_count }));
}

export async function getSaleItems(saleId: number): Promise<SaleItem[]> {
  const db = await getDb();
  return db.select<SaleItem[]>(
    "SELECT * FROM sale_items WHERE sale_id = $1 ORDER BY id",
    [saleId]
  );
}

export async function getSalesSummary(
  range?: DateRange
): Promise<{ count: number; total: number }> {
  const db = await getDb();
  const { clause, params } = dateWhere(range);
  const rows = await db.select<{ count: number; total: number }[]>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total FROM sales ${clause}`,
    params
  );
  return rows[0] ?? { count: 0, total: 0 };
}

// ---------------------------------------------------------------------------
// Stock movements
// ---------------------------------------------------------------------------

export async function listStockMovements(
  range?: DateRange
): Promise<StockMovement[]> {
  const db = await getDb();
  const { clause, params } = dateWhere(range).clause
    ? prefixAlias(dateWhere(range))
    : { clause: "", params: [] as string[] };
  return db.select<StockMovement[]>(
    `SELECT m.*, p.name AS product_name
     FROM stock_movements m
     JOIN products p ON p.id = m.product_id
     ${clause}
     ORDER BY m.created_at DESC`,
    params
  );
}

// stock_movements query joins products; qualify created_at with the m alias.
function prefixAlias(w: { clause: string; params: string[] }) {
  return { clause: w.clause.replace(/created_at/g, "m.created_at"), params: w.params };
}
