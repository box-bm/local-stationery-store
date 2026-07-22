use tauri_plugin_sql::{Migration, MigrationKind};

const SCHEMA: &str = r#"
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  barcode TEXT UNIQUE,
  category TEXT,
  base_unit_name TEXT NOT NULL,
  base_unit_quantity REAL NOT NULL DEFAULT 1,
  purchase_price REAL NOT NULL DEFAULT 0,
  stock REAL NOT NULL DEFAULT 0,
  min_stock REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sell_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity_in_base_units REAL NOT NULL,
  sell_price REAL NOT NULL,
  is_default INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  total REAL NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  sell_unit_id INTEGER NOT NULL REFERENCES sell_units(id),
  product_name TEXT NOT NULL,
  sell_unit_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  subtotal REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  type TEXT NOT NULL,
  quantity REAL NOT NULL,
  reference_id INTEGER,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_sell_units_product ON sell_units(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
"#;

const SEED: &str = r#"
-- Producto 1: papel bond, vendido por hoja, paquete de 4 y resma completa
INSERT INTO products (name, description, barcode, category, base_unit_name, base_unit_quantity, purchase_price, stock, min_stock)
VALUES ('Papel bond carta 80g', 'Resma de 500 hojas', '7501000000011', 'Papelería', 'resma', 500, 25.00, 5, 2);

INSERT INTO sell_units (product_id, name, quantity_in_base_units, sell_price, is_default) VALUES
  (1, 'Hoja individual', 0.002, 0.25, 1),
  (1, '4 hojas', 0.008, 1.00, 0),
  (1, 'Resma completa', 1, 35.00, 0);

INSERT INTO stock_movements (product_id, type, quantity, notes) VALUES
  (1, 'purchase', 5, 'Stock inicial');

-- Producto 2: lápices, vendidos por unidad o caja de 12
INSERT INTO products (name, description, barcode, category, base_unit_name, base_unit_quantity, purchase_price, stock, min_stock)
VALUES ('Lápiz Mongol #2', 'Caja con 12 lápices', '7501000000028', 'Escritura', 'caja', 12, 18.00, 10, 3);

INSERT INTO sell_units (product_id, name, quantity_in_base_units, sell_price, is_default) VALUES
  (2, 'Unidad', 0.08333333, 2.00, 1),
  (2, 'Caja (12)', 1, 22.00, 0);

INSERT INTO stock_movements (product_id, type, quantity, notes) VALUES
  (2, 'purchase', 10, 'Stock inicial');

-- Producto 3: marcador, unidad simple
INSERT INTO products (name, description, barcode, category, base_unit_name, base_unit_quantity, purchase_price, stock, min_stock)
VALUES ('Marcador permanente negro', 'Marcador punta gruesa', '7501000000035', 'Escritura', 'unidad', 1, 4.00, 40, 10);

INSERT INTO sell_units (product_id, name, quantity_in_base_units, sell_price, is_default) VALUES
  (3, 'Unidad', 1, 7.50, 1);

INSERT INTO stock_movements (product_id, type, quantity, notes) VALUES
  (3, 'purchase', 40, 'Stock inicial');
"#;

const CUSTOMERS_AND_SALE_FIELDS: &str = r#"
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE sales ADD COLUMN customer_id INTEGER REFERENCES customers(id);
ALTER TABLE sales ADD COLUMN customer_name TEXT;
ALTER TABLE sales ADD COLUMN payment_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
"#;

const SALE_ITEM_COST: &str = r#"
ALTER TABLE sale_items ADD COLUMN cost_total REAL NOT NULL DEFAULT 0;
"#;

// Replaces every autoincrement integer primary key with a UUID (v4-shaped
// hex string generated in pure SQL) so rows have a stable identity that
// survives a whole-file Google Drive sync across multiple devices. SQLite
// can't ALTER a column's type or drop AUTOINCREMENT, so each table is
// recreated via a temporary old-id -> new-uuid mapping table.
//
// `sales` additionally gains `sale_number`, seeded from the old integer id,
// because sale numbers are customer/clerk-facing (receipts, sales list,
// Excel export) and a UUID there would be unusable printed on a receipt.
const UUID_PRIMARY_KEYS: &str = r#"
PRAGMA foreign_keys = OFF;

-- products
CREATE TABLE _id_map_products (old_id INTEGER PRIMARY KEY, new_id TEXT NOT NULL);
INSERT INTO _id_map_products
  SELECT id, lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))
  FROM products;

CREATE TABLE products_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  barcode TEXT UNIQUE,
  category TEXT,
  base_unit_name TEXT NOT NULL,
  base_unit_quantity REAL NOT NULL DEFAULT 1,
  purchase_price REAL NOT NULL DEFAULT 0,
  stock REAL NOT NULL DEFAULT 0,
  min_stock REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO products_new
  SELECT m.new_id, p.name, p.description, p.barcode, p.category, p.base_unit_name,
         p.base_unit_quantity, p.purchase_price, p.stock, p.min_stock, p.created_at, p.updated_at
  FROM products p JOIN _id_map_products m ON m.old_id = p.id;
DROP TABLE products;
ALTER TABLE products_new RENAME TO products;

-- customers
CREATE TABLE _id_map_customers (old_id INTEGER PRIMARY KEY, new_id TEXT NOT NULL);
INSERT INTO _id_map_customers
  SELECT id, lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))
  FROM customers;

CREATE TABLE customers_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO customers_new
  SELECT m.new_id, c.name, c.created_at
  FROM customers c JOIN _id_map_customers m ON m.old_id = c.id;
DROP TABLE customers;
ALTER TABLE customers_new RENAME TO customers;

-- sell_units (depends on the products mapping)
CREATE TABLE _id_map_sell_units (old_id INTEGER PRIMARY KEY, new_id TEXT NOT NULL);
INSERT INTO _id_map_sell_units
  SELECT id, lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))
  FROM sell_units;

CREATE TABLE sell_units_new (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity_in_base_units REAL NOT NULL,
  sell_price REAL NOT NULL,
  is_default INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO sell_units_new
  SELECT m.new_id, pm.new_id, su.name, su.quantity_in_base_units, su.sell_price, su.is_default, su.created_at
  FROM sell_units su
  JOIN _id_map_sell_units m ON m.old_id = su.id
  JOIN _id_map_products pm ON pm.old_id = su.product_id;
DROP TABLE sell_units;
ALTER TABLE sell_units_new RENAME TO sell_units;

-- sales (depends on the customers mapping; sale_number preserves the old id)
CREATE TABLE _id_map_sales (old_id INTEGER PRIMARY KEY, new_id TEXT NOT NULL);
INSERT INTO _id_map_sales
  SELECT id, lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6)))
  FROM sales;

CREATE TABLE sales_new (
  id TEXT PRIMARY KEY,
  sale_number INTEGER NOT NULL,
  total REAL NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  payment_reference TEXT,
  customer_id TEXT REFERENCES customers(id),
  customer_name TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO sales_new
  SELECT m.new_id, s.id, s.total, s.payment_method, s.payment_reference, cm.new_id, s.customer_name, s.notes, s.created_at
  FROM sales s
  JOIN _id_map_sales m ON m.old_id = s.id
  LEFT JOIN _id_map_customers cm ON cm.old_id = s.customer_id;
DROP TABLE sales;
ALTER TABLE sales_new RENAME TO sales;

-- sale_items (depends on sales, products, sell_units)
CREATE TABLE sale_items_new (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  sell_unit_id TEXT NOT NULL REFERENCES sell_units(id),
  product_name TEXT NOT NULL,
  sell_unit_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  subtotal REAL NOT NULL,
  cost_total REAL NOT NULL DEFAULT 0
);
INSERT INTO sale_items_new
  SELECT lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))),
         sm.new_id, pm.new_id, sum.new_id, si.product_name, si.sell_unit_name, si.quantity, si.unit_price, si.subtotal, si.cost_total
  FROM sale_items si
  JOIN _id_map_sales sm ON sm.old_id = si.sale_id
  JOIN _id_map_products pm ON pm.old_id = si.product_id
  JOIN _id_map_sell_units sum ON sum.old_id = si.sell_unit_id;
DROP TABLE sale_items;
ALTER TABLE sale_items_new RENAME TO sale_items;

-- stock_movements (product_id -> products; reference_id -> sales, only when type='sale')
CREATE TABLE stock_movements_new (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  type TEXT NOT NULL,
  quantity REAL NOT NULL,
  reference_id TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO stock_movements_new
  SELECT lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random())%4+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))),
         pm.new_id, sm2.type, sm2.quantity,
         CASE WHEN sm2.type = 'sale' THEN salem.new_id ELSE NULL END,
         sm2.notes, sm2.created_at
  FROM stock_movements sm2
  JOIN _id_map_products pm ON pm.old_id = sm2.product_id
  LEFT JOIN _id_map_sales salem ON salem.old_id = sm2.reference_id;
DROP TABLE stock_movements;
ALTER TABLE stock_movements_new RENAME TO stock_movements;

DROP TABLE _id_map_products;
DROP TABLE _id_map_customers;
DROP TABLE _id_map_sell_units;
DROP TABLE _id_map_sales;

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_sell_units_product ON sell_units(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

PRAGMA foreign_keys = ON;
"#;

// Tracks which schema version this database was migrated to, independent of
// whatever tauri-plugin-sql does internally. Google Drive sync compares this
// against the remote file's `dbSchemaVersion` app property before pulling,
// so an app build that doesn't yet understand a newer schema never applies
// it. Every future migration that changes the schema must also bump the
// seeded value here (see the "Adding a migration" note in CLAUDE.md).
const SYNC_SCHEMA_META: &str = r#"
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
INSERT OR REPLACE INTO app_meta (key, value) VALUES ('schema_version', '6');
"#;

/// Store the Google Drive OAuth refresh token in the OS-native credential
/// store (Windows Credential Manager / macOS Keychain / Linux Secret
/// Service) rather than in an app-managed file. This is a deliberate,
/// narrow exception to this project's "no custom Rust commands" rule,
/// authorized specifically for securing the user's Google account
/// credential — see the note in CLAUDE.md.
#[tauri::command]
fn keyring_set(service: String, account: String, secret: String) -> Result<(), String> {
    let entry = keyring::Entry::new(&service, &account).map_err(|e| e.to_string())?;
    entry.set_password(&secret).map_err(|e| e.to_string())
}

#[tauri::command]
fn keyring_get(service: String, account: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(&service, &account).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn keyring_delete(service: String, account: String) -> Result<(), String> {
    let entry = keyring::Entry::new(&service, &account).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_schema",
            sql: SCHEMA,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "seed_example_products",
            sql: SEED,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "customers_and_sale_fields",
            sql: CUSTOMERS_AND_SALE_FIELDS,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "sale_items_cost_total",
            sql: SALE_ITEM_COST,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "uuid_primary_keys",
            sql: UUID_PRIMARY_KEYS,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "sync_schema_meta",
            sql: SYNC_SCHEMA_META,
            kind: MigrationKind::Up,
        },
    ];

    let builder = tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:libreria.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            keyring_set,
            keyring_get,
            keyring_delete
        ]);

    // Updater + process relaunch are desktop-only.
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
