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
    ];

    let builder = tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:libreria.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init());

    // Updater + process relaunch are desktop-only.
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
