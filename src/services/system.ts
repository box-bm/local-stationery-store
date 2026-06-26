import { appConfigDir, join } from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import { copyFile, exists, remove } from "@tauri-apps/plugin-fs";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { relaunch } from "@tauri-apps/plugin-process";
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

/**
 * Restore the database from a user-chosen .db backup file, overwriting all
 * current data. Checkpoints + drops any WAL/SHM sidecar files so the
 * restored file is the sole source of truth, then relaunches the app so a
 * fresh connection picks it up cleanly.
 */
export async function restoreDatabase(): Promise<boolean> {
  const src = await open({
    multiple: false,
    filters: [{ name: "SQLite", extensions: ["db"] }],
  });
  if (!src) return false;

  const db = await getDb();
  try {
    await db.execute("PRAGMA wal_checkpoint(TRUNCATE);");
  } catch {
    /* checkpoint is best-effort */
  }

  const dbPath = await getDbPath();
  await copyFile(src as string, dbPath);

  // Drop stale WAL/SHM sidecars left over from the previous database so the
  // restored file isn't merged with leftover write-ahead data.
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = dbPath + suffix;
    try {
      if (await exists(sidecar)) await remove(sidecar);
    } catch {
      /* best-effort cleanup */
    }
  }

  await relaunch();
  return true;
}
