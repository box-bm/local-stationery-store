import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";

export interface UpdateInfo {
  available: boolean;
  version?: string;
  notes?: string;
  update?: Update;
}

/** Current installed app version (from tauri.conf.json). */
export async function currentVersion(): Promise<string> {
  try {
    return await getVersion();
  } catch {
    return "0.0.0";
  }
}

/** Check the configured endpoint for a newer release. */
export async function checkForUpdate(): Promise<UpdateInfo> {
  const update = await check();
  if (update) {
    return {
      available: true,
      version: update.version,
      notes: update.body,
      update,
    };
  }
  return { available: false };
}

/** Download + install the given update, then relaunch the app. */
export async function installUpdate(update: Update): Promise<void> {
  await update.downloadAndInstall();
  await relaunch();
}
