import { appConfigDir, join } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { copyFile } from "@tauri-apps/plugin-fs";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { getDb } from "./db";

const DB_FILE = "libreria.db";

/** Absolute path to the SQLite database file. */
export async function getDbPath(): Promise<string> {
  return join(await appConfigDir(), DB_FILE);
}

/** Folder where all app data (the database) is stored. */
export async function getDataDir(): Promise<string> {
  return appConfigDir();
}

/** Open the data folder in the OS file manager. */
export async function openDataFolder(): Promise<void> {
  await openPath(await appConfigDir());
}

/** Reveal the database file in the OS file manager. */
export async function revealDatabase(): Promise<void> {
  await revealItemInDir(await getDbPath());
}

/**
 * Create a .db backup at a user-chosen location. Checkpoints the WAL first so
 * the copied file is fully consistent.
 */
export async function backupDatabase(): Promise<boolean> {
  const db = await getDb();
  try {
    await db.execute("PRAGMA wal_checkpoint(TRUNCATE);");
  } catch {
    /* checkpoint is best-effort */
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const dest = await save({
    defaultPath: `respaldo_libreria_${stamp}.db`,
    filters: [{ name: "SQLite", extensions: ["db"] }],
  });
  if (!dest) return false;

  await copyFile(await getDbPath(), dest);
  return true;
}
