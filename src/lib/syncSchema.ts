import { getDb } from "@/services/db";

/**
 * Highest schema version this build understands. Must match the value
 * seeded into `app_meta.schema_version` by the latest migration in
 * src-tauri/src/lib.rs (currently migration 6, "sync_schema_meta"). Bump
 * this alongside any future migration that changes the schema — see the
 * "Adding a migration" note in CLAUDE.md.
 */
export const CURRENT_SCHEMA_VERSION = 6;

/** Reads the local database's own recorded schema version. */
export async function getLocalSchemaVersion(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM app_meta WHERE key = 'schema_version'"
  );
  return rows.length ? Number(rows[0].value) : 0;
}
