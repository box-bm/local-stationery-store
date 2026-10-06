import Database from "@tauri-apps/plugin-sql";
import { cartTotal, lineSubtotal, stockDeducted } from "@/lib/calc";
import { countStock, type StockCounts } from "@/lib/stock";
import { fuzzyIncludes } from "@/lib/text";
import { useSettingsStore } from "@/stores/settings";
import type {
  Product,
  ProductInput,
  ProductWithUnits,
  Sale,
  SaleItem,
  SaleWithItems,
  SalesSegment,
  SalesSegmentGranularity,
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

/** Marks the local DB as having unsynced changes, for Google Drive sync. */
function markDirty() {
  try {
    useSettingsStore.getState().setSyncPending(true);
  } catch {
    /* sync is optional; never let this break a write */
  }
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function listProducts(search?: string): Promise<Product[]> {
  const db = await getDb();
  const all = await db.select<Product[]>(
    "SELECT * FROM products ORDER BY name COLLATE NOCASE"
  );
  if (!search || !search.trim()) return all;
  const term = search.trim();
  return all.filter(
    (p) =>
      fuzzyIncludes(p.name, term) ||
      fuzzyIncludes(p.barcode, term) ||
      fuzzyIncludes(p.category, term)
  );
}

export async function getSellUnits(productId: string): Promise<SellUnit[]> {
  const db = await getDb();
  return db.select<SellUnit[]>(
    "SELECT * FROM sell_units WHERE product_id = $1 ORDER BY quantity_in_base_units",
    [productId]
  );
}

export async function getProductWithUnits(
  id: string
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
  const term = search.trim();
  let products: Product[];
  if (term) {
    const all = await db.select<Product[]>(
      "SELECT * FROM products ORDER BY name COLLATE NOCASE"
    );
    products = all
      .filter(
        (p) =>
          fuzzyIncludes(p.name, term) ||
          fuzzyIncludes(p.barcode, term) ||
          fuzzyIncludes(p.category, term)
      )
      .slice(0, limit);
  } else {
    products = await db.select<Product[]>(
      "SELECT * FROM products ORDER BY name COLLATE NOCASE LIMIT $1",
      [limit]
    );
  }
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

export interface CategoryWithCount {
  category: string;
  count: number;
}

/** Categories with how many products use each, for the management screen. */
export async function listCategoriesWithCounts(): Promise<CategoryWithCount[]> {
  const db = await getDb();
  return db.select<CategoryWithCount[]>(
    `SELECT category, COUNT(*) AS count FROM products
     WHERE category IS NOT NULL AND category <> ''
     GROUP BY category ORDER BY category COLLATE NOCASE`
  );
}

/** Rename a category across all products that use it. */
export async function renameCategory(
  oldName: string,
  newName: string
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE products SET category = $1, updated_at = CURRENT_TIMESTAMP WHERE category = $2",
    [newName.trim(), oldName]
  );
  markDirty();
}

/** Clear a category from every product that uses it (products are kept). */
export async function deleteCategory(name: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE products SET category = NULL, updated_at = CURRENT_TIMESTAMP WHERE category = $1",
    [name]
  );
  markDirty();
}

/** Merge several categories into one target category. */
export async function mergeCategories(
  sourceNames: string[],
  targetName: string
): Promise<void> {
  const db = await getDb();
  const toMerge = sourceNames.filter((n) => n !== targetName);
  for (const name of toMerge) {
    await db.execute(
      "UPDATE products SET category = $1, updated_at = CURRENT_TIMESTAMP WHERE category = $2",
      [targetName.trim(), name]
    );
  }
  markDirty();
}

/** Insert a product plus its sell units; records an initial purchase movement. */
export async function createProduct(input: ProductInput): Promise<string> {
  const db = await getDb();
  const productId = crypto.randomUUID();
  await db.execute(
    `INSERT INTO products
       (id, name, description, barcode, category, base_unit_name, base_unit_quantity, purchase_price, stock, min_stock)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      productId,
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

  await replaceSellUnits(productId, input.sell_units);

  if (input.stock > 0) {
    await db.execute(
      `INSERT INTO stock_movements (id, product_id, type, quantity, notes)
       VALUES ($1, $2, 'purchase', $3, $4)`,
      [crypto.randomUUID(), productId, input.stock, "Stock inicial"]
    );
  }
  markDirty();
  return productId;
}

/** Update a product's fields and replace its sell units. Does NOT change stock. */
export async function updateProduct(
  id: string,
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
  markDirty();
}

/** Delete + reinsert sell units for a product (simplest reliable sync). */
async function replaceSellUnits(
  productId: string,
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
      `INSERT INTO sell_units (id, product_id, name, quantity_in_base_units, sell_price, is_default)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        crypto.randomUUID(),
        productId,
        u.name,
        u.quantity_in_base_units,
        u.sell_price,
        isDefault,
      ]
    );
  }
}

/** Add stock (a restock / purchase). Records a movement. */
export async function restockProduct(
  productId: string,
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
    `INSERT INTO stock_movements (id, product_id, type, quantity, notes)
     VALUES ($1, $2, 'purchase', $3, $4)`,
    [crypto.randomUUID(), productId, quantityBaseUnits, notes ?? "Reabastecimiento"]
  );
  markDirty();
}

/** Manually set stock to an exact value, recording an adjustment movement. */
export async function adjustStock(
  productId: string,
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
    `INSERT INTO stock_movements (id, product_id, type, quantity, notes)
     VALUES ($1, $2, 'adjustment', $3, $4)`,
    [crypto.randomUUID(), productId, delta, notes ?? "Ajuste manual de inventario"]
  );
  markDirty();
}

export async function deleteProduct(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM products WHERE id = $1", [id]);
  markDirty();
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
  const term = search.trim();
  if (!term) {
    return db.select<Customer[]>(
      "SELECT * FROM customers ORDER BY name COLLATE NOCASE LIMIT $1",
      [limit]
    );
  }
  const all = await db.select<Customer[]>(
    "SELECT * FROM customers ORDER BY name COLLATE NOCASE"
  );
  return all.filter((c) => fuzzyIncludes(c.name, term)).slice(0, limit);
}

export interface CustomerWithCount extends Customer {
  sale_count: number;
}

/** Customers with their sale counts, for the management screen. */
export async function listCustomersWithCounts(): Promise<CustomerWithCount[]> {
  const db = await getDb();
  return db.select<CustomerWithCount[]>(
    `SELECT c.*, COUNT(s.id) AS sale_count
     FROM customers c
     LEFT JOIN sales s ON s.customer_id = c.id
     GROUP BY c.id ORDER BY c.name COLLATE NOCASE`
  );
}

/** Rename a customer; past sales keep their original snapshot name. */
export async function renameCustomer(id: string, name: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE customers SET name = $1 WHERE id = $2", [
    name.trim(),
    id,
  ]);
  markDirty();
}

/** Delete a customer. Past sales are kept but unlinked (customer_name snapshot remains). */
export async function deleteCustomer(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE sales SET customer_id = NULL WHERE customer_id = $1", [
    id,
  ]);
  await db.execute("DELETE FROM customers WHERE id = $1", [id]);
  markDirty();
}

/** Merge several customers into one target; reassigns their sales and deletes the rest. */
export async function mergeCustomers(
  sourceIds: string[],
  targetId: string
): Promise<void> {
  const db = await getDb();
  const toMerge = sourceIds.filter((id) => id !== targetId);
  for (const id of toMerge) {
    await db.execute("UPDATE sales SET customer_id = $1 WHERE customer_id = $2", [
      targetId,
      id,
    ]);
    await db.execute("DELETE FROM customers WHERE id = $1", [id]);
  }
  markDirty();
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
  const id = crypto.randomUUID();
  await db.execute("INSERT INTO customers (id, name) VALUES ($1, $2)", [
    id,
    trimmed,
  ]);
  return { id, name: trimmed, created_at: "" };
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export interface CompleteSaleResult {
  saleNumber: number;
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
  let customerId: string | null = null;
  let customerName: string | null = null;
  if (meta.customerName && meta.customerName.trim()) {
    const customer = await findOrCreateCustomer(meta.customerName);
    customerId = customer.id;
    customerName = customer.name;
  }

  const saleId = crypto.randomUUID();
  const numberRows = await db.select<{ next: number }[]>(
    "SELECT COALESCE(MAX(sale_number), 0) + 1 AS next FROM sales"
  );
  const saleNumber = numberRows[0].next;

  await db.execute(
    `INSERT INTO sales
       (id, sale_number, total, payment_method, payment_reference, customer_id, customer_name, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      saleId,
      saleNumber,
      total,
      meta.paymentMethod,
      meta.paymentReference?.trim() || null,
      customerId,
      customerName,
      meta.notes?.trim() || null,
    ]
  );

  for (const item of cart) {
    const subtotal = lineSubtotal(item.sellUnit.sell_price, item.quantity);
    const costTotal =
      item.product.purchase_price *
      item.sellUnit.quantity_in_base_units *
      item.quantity;
    await db.execute(
      `INSERT INTO sale_items
         (id, sale_id, product_id, sell_unit_id, product_name, sell_unit_name, quantity, unit_price, subtotal, cost_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        crypto.randomUUID(),
        saleId,
        item.product.id,
        item.sellUnit.id,
        item.product.name,
        item.sellUnit.name,
        item.quantity,
        item.sellUnit.sell_price,
        subtotal,
        costTotal,
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
      `INSERT INTO stock_movements (id, product_id, type, quantity, reference_id, notes)
       VALUES ($1, $2, 'sale', $3, $4, $5)`,
      [
        crypto.randomUUID(),
        item.product.id,
        -deducted,
        saleId,
        `Venta #${saleNumber}: ${item.quantity} x ${item.sellUnit.name}`,
      ]
    );
  }

  markDirty();
  return { saleNumber, total };
}

export interface DateRange {
  from?: string; // ISO date (inclusive)
  to?: string; // ISO date (inclusive)
}

export interface DashboardFilters {
  productId?: string;
  paymentMethod?: string;
  customerId?: string;
}

function dashboardWhere(range?: DateRange, filters?: DashboardFilters): { clause: string; params: string[] } {
  const params: string[] = [];
  const parts: string[] = [];
  if (range?.from) { params.push(range.from); parts.push(`s.created_at >= $${params.length}`); }
  if (range?.to) { params.push(range.to + " 23:59:59"); parts.push(`s.created_at <= $${params.length}`); }
  if (filters?.paymentMethod) { params.push(filters.paymentMethod); parts.push(`s.payment_method = $${params.length}`); }
  if (filters?.customerId) { params.push(filters.customerId); parts.push(`s.customer_id = $${params.length}`); }
  if (filters?.productId) { params.push(filters.productId); parts.push(`EXISTS (SELECT 1 FROM sale_items fp WHERE fp.sale_id = s.id AND fp.product_id = $${params.length})`); }
  return { clause: parts.length ? `WHERE ${parts.join(" AND ")}` : "", params };
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

export interface Pagination {
  limit: number;
  offset: number;
}

export async function listSales(
  range?: DateRange,
  pagination?: Pagination
): Promise<SaleWithItems[]> {
  const db = await getDb();
  const { clause, params } = dateWhere(range);
  let sql = `SELECT s.*, COALESCE(SUM(si.quantity), 0) AS item_count
     FROM sales s
     LEFT JOIN sale_items si ON si.sale_id = s.id
     ${clause}
     GROUP BY s.id
     ORDER BY s.created_at DESC`;
  const allParams: (string | number)[] = [...params];
  if (pagination) {
    allParams.push(pagination.limit, pagination.offset);
    sql += ` LIMIT $${allParams.length - 1} OFFSET $${allParams.length}`;
  }
  const sales = await db.select<(Sale & { item_count: number })[]>(
    sql,
    allParams
  );
  return sales.map((s) => ({ ...s, items: [], item_count: s.item_count }));
}

/** Count of sales matching a date range, for pagination controls. */
export async function countSales(range?: DateRange): Promise<number> {
  const db = await getDb();
  const { clause, params } = dateWhere(range);
  const rows = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) AS count FROM sales ${clause}`,
    params
  );
  return rows[0]?.count ?? 0;
}

export async function getSaleItems(saleId: string): Promise<SaleItem[]> {
  const db = await getDb();
  return db.select<SaleItem[]>(
    "SELECT * FROM sale_items WHERE sale_id = $1 ORDER BY id",
    [saleId]
  );
}

export async function getSalesSummary(
  range?: DateRange,
  filters?: DashboardFilters
): Promise<{ count: number; total: number; profit: number }> {
  const db = await getDb();
  const { clause, params } = dashboardWhere(range, filters);
  const rows = await db.select<{ count: number; total: number; cost: number }[]>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(s.total), 0) AS total,
            COALESCE(SUM(
              (SELECT SUM(si.cost_total) FROM sale_items si WHERE si.sale_id = s.id)
            ), 0) AS cost
     FROM sales s ${clause}`,
    params
  );
  const r = rows[0] ?? { count: 0, total: 0, cost: 0 };
  return { count: r.count, total: r.total, profit: r.total - r.cost };
}

const SEGMENT_FORMAT: Record<SalesSegmentGranularity, string> = {
  day: "%Y-%m-%d",
  week: "%Y-W%W",
  month: "%Y-%m",
  year: "%Y",
};

/** Sales aggregated into day/week/month/year buckets, most recent first. */
export async function getSalesSegments(
  range: DateRange | undefined,
  granularity: SalesSegmentGranularity,
  filters?: DashboardFilters
): Promise<SalesSegment[]> {
  const db = await getDb();
  const { clause, params } = dashboardWhere(range, filters);
  const fmt = SEGMENT_FORMAT[granularity];
  const rows = await db.select<
    { period: string; count: number; total: number; cost: number }[]
  >(
    `SELECT period, COUNT(*) AS count, SUM(sale_total) AS total, SUM(sale_cost) AS cost
     FROM (
       SELECT strftime('${fmt}', s.created_at) AS period,
              s.total AS sale_total,
              COALESCE(
                (SELECT SUM(si.cost_total) FROM sale_items si WHERE si.sale_id = s.id), 0
              ) AS sale_cost
       FROM sales s
       ${clause}
     )
     GROUP BY period
     ORDER BY period DESC`,
    params
  );
  return rows.map((r) => ({
    period: r.period,
    count: r.count,
    total: r.total,
    profit: r.total - r.cost,
  }));
}

export interface TopProduct {
  product_name: string;
  quantity: number;
  revenue: number;
  profit: number;
}

/** Products ranked by units sold in a date range for dashboard/reporting views. */
export async function getTopProducts(range?: DateRange, limit = 5): Promise<TopProduct[]> {
  return getTopProductsFiltered(range, undefined, limit);
}

export async function getTopProductsFiltered(range?: DateRange, filters?: DashboardFilters, limit = 5): Promise<TopProduct[]> {
  const db = await getDb();
  const { clause, params } = dashboardWhere(range, filters);
  return db.select<TopProduct[]>(
    `SELECT si.product_name, SUM(si.quantity) AS quantity,
            SUM(si.subtotal) AS revenue,
            SUM(si.subtotal - si.cost_total) AS profit
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       ${clause.replace(/created_at/g, "s.created_at")}
       GROUP BY si.product_id, si.product_name
       ORDER BY quantity DESC, revenue DESC
       LIMIT $${params.length + 1}`,
    [...params, limit]
  );
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
