// In-memory SQLite stand-in for @tauri-apps/plugin-sql, so the queries in
// src/services/db.ts can be tested against the real schema without the
// Tauri runtime. The schema is built by running the actual migrations from
// src-tauri/src/lib.rs, so tests break if the Rust schema and the TS queries
// drift apart.
import { readFileSync } from "node:fs";
import path from "node:path";
import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";

const LIB_RS = path.resolve(__dirname, "../../src-tauri/src/lib.rs");

export interface ParsedMigration {
  version: number;
  description: string;
  sql: string;
}

/** Extracts the ordered migrations (and their raw SQL constants) from lib.rs. */
export function readMigrations(): ParsedMigration[] {
  const src = readFileSync(LIB_RS, "utf8");

  const consts = new Map<string, string>();
  for (const m of src.matchAll(/const (\w+): &str = r#"([\s\S]*?)"#;/g)) {
    consts.set(m[1], m[2]);
  }

  const migrations: ParsedMigration[] = [];
  const re =
    /Migration \{\s*version: (\d+),\s*description: "([^"]+)",\s*sql: (\w+),/g;
  for (const m of src.matchAll(re)) {
    const sql = consts.get(m[3]);
    if (sql == null) throw new Error(`SQL constant ${m[3]} not found in lib.rs`);
    migrations.push({ version: Number(m[1]), description: m[2], sql });
  }
  return migrations;
}

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

/** Minimal subset of the plugin-sql `Database` API used by db.ts. */
export class FakeDatabase {
  constructor(public raw: SqlJsDatabase) {}

  /** plugin-sql uses `$1`-style params; SQLite understands them as `?1`. */
  private static convert(sql: string): string {
    return sql.replace(/\$(\d+)/g, "?$1");
  }

  async execute(sql: string, params: unknown[] = []) {
    this.raw.run(FakeDatabase.convert(sql), params as never);
    return { rowsAffected: this.raw.getRowsModified(), lastInsertId: 0 };
  }

  async select<T>(sql: string, params: unknown[] = []): Promise<T> {
    const stmt = this.raw.prepare(FakeDatabase.convert(sql));
    try {
      stmt.bind(params as never);
      const rows: Record<string, unknown>[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows as T;
    } finally {
      stmt.free();
    }
  }

  async close() {
    this.raw.close();
    return true;
  }
}

/** Creates a fresh in-memory DB migrated up to `upTo` (default: latest). */
export async function createTestDb(
  opts: { upTo?: number; seed?: boolean } = {}
): Promise<FakeDatabase> {
  SQL ??= await initSqlJs();
  const db = new SQL.Database();
  for (const m of readMigrations()) {
    if (opts.upTo != null && m.version > opts.upTo) break;
    // Migration 2 seeds example products; most tests want an empty catalog.
    if (m.version === 2 && opts.seed === false) continue;
    db.exec(m.sql);
  }
  db.exec("PRAGMA foreign_keys = ON;");
  return new FakeDatabase(db);
}
