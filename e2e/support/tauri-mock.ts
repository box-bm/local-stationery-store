// Simulación del runtime de Tauri v2 para correr el frontend en el navegador.
//
// Los paquetes @tauri-apps/* llaman a `window.__TAURI_INTERNALS__.invoke(cmd,
// args)`. Aquí se instala ese objeto antes de que cargue la app y se atienden
// los comandos de `tauri-plugin-sql` con un SQLite real en memoria (sql.js,
// build asm.js para no depender de un .wasm). El esquema se construye
// ejecutando las migraciones reales de src-tauri/src/lib.rs, igual que hace
// src/test/sqlite.ts para Vitest, así que si cambia el esquema las pruebas
// E2E lo detectan.

export interface SellUnitFixture {
  id: string;
  name: string;
  quantity_in_base_units: number;
  sell_price: number;
  is_default: number;
}

export interface ProductFixture {
  id: string;
  name: string;
  barcode?: string | null;
  category?: string | null;
  base_unit_name: string;
  purchase_price: number;
  stock: number;
  min_stock: number;
  sell_units: SellUnitFixture[];
}

export interface TauriMockOptions {
  /** Código fuente de node_modules/sql.js/dist/sql-asm.js. */
  sqlJsSource: string;
  /** Contenido de src-tauri/src/lib.rs. */
  libRs: string;
  /** Productos adicionales a insertar tras las migraciones. */
  products?: ProductFixture[];
  /** Ejecutar la migración v2 (3 productos de ejemplo). Por defecto true. */
  seed?: boolean;
}

/** Helpers que la suite usa para consultar la BD simulada desde los tests. */
export interface E2EHandle {
  ready: Promise<void>;
  select<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<void>;
  /** Comandos IPC recibidos, en orden (útil para depurar). */
  calls: { cmd: string; args: unknown }[];
}

declare global {
  interface Window {
    __TAURI_INTERNALS__: unknown;
    __E2E__: E2EHandle;
    initSqlJs?: (cfg?: unknown) => Promise<any>;
  }
}

interface ParsedMigration {
  version: number;
  sql: string;
}

/** Extrae las migraciones (y sus constantes SQL) de lib.rs, en orden. */
export function parseMigrations(libRs: string): ParsedMigration[] {
  const consts = new Map<string, string>();
  for (const m of libRs.matchAll(/const (\w+): &str = r#"([\s\S]*?)"#;/g)) {
    consts.set(m[1], m[2]);
  }
  const out: ParsedMigration[] = [];
  const re = /Migration \{\s*version: (\d+),\s*description: "([^"]+)",\s*sql: (\w+),/g;
  for (const m of libRs.matchAll(re)) {
    const sql = consts.get(m[3]);
    if (sql == null) throw new Error(`Constante SQL ${m[3]} no encontrada en lib.rs`);
    out.push({ version: Number(m[1]), sql });
  }
  if (!out.length) throw new Error("No se encontraron migraciones en lib.rs");
  return out;
}

/** plugin-sql usa parámetros `$1`; SQLite los entiende como `?1`. */
const convert = (sql: string) => sql.replace(/\$(\d+)/g, "?$1");

export function installTauriMock(win: Window, opts: TauriMockOptions) {
  // Evaluar sql.js en el ámbito global de la app define `initSqlJs`.
  win.eval(opts.sqlJsSource);
  const initSqlJs = win.initSqlJs;
  if (!initSqlJs) throw new Error("sql.js no se pudo cargar en la ventana");

  let db: any;
  const ready: Promise<void> = initSqlJs().then((SQL: any) => {
    db = new SQL.Database();
    for (const m of parseMigrations(opts.libRs)) {
      if (m.version === 2 && opts.seed === false) continue;
      db.exec(m.sql);
    }
    for (const p of opts.products ?? []) {
      db.run(
        `INSERT INTO products (id, name, barcode, category, base_unit_name, base_unit_quantity, purchase_price, stock, min_stock)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        [p.id, p.name, p.barcode ?? null, p.category ?? null, p.base_unit_name, p.purchase_price, p.stock, p.min_stock]
      );
      for (const u of p.sell_units) {
        db.run(
          `INSERT INTO sell_units (id, product_id, name, quantity_in_base_units, sell_price, is_default)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [u.id, p.id, u.name, u.quantity_in_base_units, u.sell_price, u.is_default]
        );
      }
    }
  });

  function select(sql: string, params: unknown[] = []) {
    const stmt = db.prepare(convert(sql));
    try {
      stmt.bind(params);
      const rows: Record<string, unknown>[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally {
      stmt.free();
    }
  }

  function execute(sql: string, params: unknown[] = []): [number, number] {
    db.run(convert(sql), params);
    return [db.getRowsModified(), 0];
  }

  const calls: E2EHandle["calls"] = [];
  const callbacks = new Map<number, (data: unknown) => void>();
  let nextCallback = 1;

  async function invoke(cmd: string, args: any = {}) {
    calls.push({ cmd, args });
    await ready;
    switch (cmd) {
      case "plugin:sql|load":
        return args.db;
      case "plugin:sql|execute":
        return execute(args.query, args.values);
      case "plugin:sql|select":
        return select(args.query, args.values);
      case "plugin:sql|close":
        return true;
      case "plugin:updater|check":
        return null; // sin actualizaciones
      case "plugin:app|version":
        return "0.0.0-e2e";
      default:
        throw new Error(`[tauri-mock] comando no simulado: ${cmd}`);
    }
  }

  win.__TAURI_INTERNALS__ = {
    invoke,
    transformCallback(cb: (data: unknown) => void) {
      const id = nextCallback++;
      callbacks.set(id, cb);
      return id;
    },
    unregisterCallback(id: number) {
      callbacks.delete(id);
    },
    convertFileSrc: (path: string) => path,
    metadata: {
      currentWindow: { label: "main" },
      currentWebview: { windowLabel: "main", label: "main" },
    },
  };

  win.__E2E__ = {
    ready,
    calls,
    select: async (sql, params) => {
      await ready;
      return select(sql, params) as never;
    },
    execute: async (sql, params) => {
      await ready;
      execute(sql, params);
    },
  };
}
