import { describe, it, expect } from "vitest";
import { createTestDb, readMigrations } from "@/test/sqlite";
import { CURRENT_SCHEMA_VERSION } from "@/lib/syncSchema";

describe("migrations (src-tauri/src/lib.rs)", () => {
  const migrations = readMigrations();

  it("are numbered sequentially starting at 1", () => {
    expect(migrations.map((m) => m.version)).toEqual(
      migrations.map((_, i) => i + 1)
    );
  });

  it("CURRENT_SCHEMA_VERSION matches the latest migration", () => {
    // See "Adding a migration" in CLAUDE.md: forgetting this bump breaks
    // Google Drive sync's schema gate.
    expect(CURRENT_SCHEMA_VERSION).toBe(migrations[migrations.length - 1].version);
  });

  it("seeded app_meta.schema_version matches CURRENT_SCHEMA_VERSION", async () => {
    const db = await createTestDb();
    const rows = await db.select<{ value: string }[]>(
      "SELECT value FROM app_meta WHERE key = 'schema_version'"
    );
    expect(Number(rows[0].value)).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("apply cleanly on a fresh database including the seed data", async () => {
    const db = await createTestDb();
    const products = await db.select<{ id: string }[]>("SELECT id FROM products");
    expect(products.length).toBe(3);
    // v5 replaced integer ids with UUIDs.
    for (const p of products) {
      expect(p.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });

  it("v5 preserves sales data and turns the old integer id into sale_number", async () => {
    const db = await createTestDb({ upTo: 4 });
    const [p] = await db.select<{ id: number }[]>("SELECT id FROM products LIMIT 1");
    const [u] = await db.select<{ id: number }[]>(
      "SELECT id FROM sell_units WHERE product_id = $1 LIMIT 1",
      [p.id]
    );
    await db.execute("INSERT INTO customers (name) VALUES ('Ana')");
    await db.execute(
      "INSERT INTO sales (id, total, payment_method, customer_id, customer_name) VALUES (42, 10, 'cash', 1, 'Ana')"
    );
    await db.execute(
      `INSERT INTO sale_items (sale_id, product_id, sell_unit_id, product_name, sell_unit_name, quantity, unit_price, subtotal, cost_total)
       VALUES (42, $1, $2, 'X', 'U', 2, 5, 10, 4)`,
      [p.id, u.id]
    );
    await db.execute(
      "INSERT INTO stock_movements (product_id, type, quantity, reference_id) VALUES ($1, 'sale', -2, 42)",
      [p.id]
    );

    for (const m of readMigrations().filter((m) => m.version >= 5)) {
      db.raw.exec(m.sql);
    }

    const [sale] = await db.select<{ id: string; sale_number: number; customer_id: string }[]>(
      "SELECT id, sale_number, customer_id FROM sales"
    );
    expect(sale.sale_number).toBe(42);
    expect(typeof sale.id).toBe("string");

    const [customer] = await db.select<{ id: string }[]>("SELECT id FROM customers");
    expect(sale.customer_id).toBe(customer.id);

    const items = await db.select<{ sale_id: string }[]>("SELECT sale_id FROM sale_items");
    expect(items).toEqual([{ sale_id: sale.id }]);

    const [mv] = await db.select<{ reference_id: string }[]>(
      "SELECT reference_id FROM stock_movements WHERE type = 'sale'"
    );
    expect(mv.reference_id).toBe(sale.id);

    const fk = await db.select<unknown[]>("PRAGMA foreign_key_check");
    expect(fk).toEqual([]);
  });
});
