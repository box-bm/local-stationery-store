import { create } from "zustand";
import { readFile, writeFile, exists, remove } from "@tauri-apps/plugin-fs";
import { relaunch } from "@tauri-apps/plugin-process";
import { getDb } from "./db";
import { getDbPath } from "./system";
import * as vault from "./vault";
import {
  requestDeviceCode,
  pollForToken,
  refreshAccessToken,
  type DeviceCodeInfo,
} from "./googleAuth";
import {
  findExistingSyncFile,
  getSyncFileMeta,
  uploadSyncFile,
  downloadSyncFile,
  type DriveFileMeta,
} from "./googleDrive";
import { CURRENT_SCHEMA_VERSION, getLocalSchemaVersion } from "@/lib/syncSchema";
import { useSettingsStore } from "@/stores/settings";
import { useCartStore } from "@/stores/cart";

export type { DeviceCodeInfo, DriveFileMeta };

// ---------------------------------------------------------------------------
// Reactive UI state — separate from the persisted settings store because
// this reflects transient sync status, not user configuration.
// ---------------------------------------------------------------------------

export interface PendingRemoteChange {
  fileId: string;
  remoteModifiedTime: string;
  deviceName: string | null;
  syncedAt: string | null;
}

interface SyncUiState {
  /** A compatible remote change is ready — ApplySyncModal should be shown. */
  pendingRemoteChange: PendingRemoteChange | null;
  /** The cloud data uses a schema newer than this build understands. */
  schemaBlocked: boolean;
  setPendingRemoteChange: (c: PendingRemoteChange | null) => void;
  setSchemaBlocked: (b: boolean) => void;
}

export const useSyncUiStore = create<SyncUiState>((set) => ({
  pendingRemoteChange: null,
  schemaBlocked: false,
  setPendingRemoteChange: (pendingRemoteChange) => set({ pendingRemoteChange }),
  setSchemaBlocked: (schemaBlocked) => set({ schemaBlocked }),
}));

// ---------------------------------------------------------------------------
// Local DB file <-> bytes, reusing the checkpoint-then-copy pattern already
// used for manual backup/restore in src/services/system.ts.
// ---------------------------------------------------------------------------

async function checkpoint(): Promise<void> {
  const db = await getDb();
  try {
    await db.execute("PRAGMA wal_checkpoint(TRUNCATE);");
  } catch {
    /* best-effort */
  }
}

async function readDbBytes(): Promise<Uint8Array> {
  await checkpoint();
  return readFile(await getDbPath());
}

async function writeDbBytes(bytes: Uint8Array): Promise<void> {
  await checkpoint();
  const dbPath = await getDbPath();
  await writeFile(dbPath, bytes);
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = dbPath + suffix;
    try {
      if (await exists(sidecar)) await remove(sidecar);
    } catch {
      /* best-effort cleanup */
    }
  }
}

async function getAccessToken(): Promise<string> {
  const refreshToken = await vault.getRefreshToken();
  if (!refreshToken) throw new Error("Google Drive no está conectado");
  const { accessToken } = await refreshAccessToken(refreshToken);
  return accessToken;
}

// ---------------------------------------------------------------------------
// Connect / disconnect
// ---------------------------------------------------------------------------

export interface ConnectResult {
  existing: DriveFileMeta | null;
}

/** Runs the device-code OAuth flow and stores the refresh token in the OS keyring. */
export async function connectGoogleDrive(
  onCode: (info: DeviceCodeInfo) => void
): Promise<ConnectResult> {
  const info = await requestDeviceCode();
  onCode(info);
  const token = await pollForToken(info);
  await vault.setRefreshToken(token.refreshToken);
  const existing = await findExistingSyncFile(token.accessToken);
  return { existing };
}

/** User's explicit choice on first connect: adopt what's already in Drive. */
export async function adoptRemote(fileId: string): Promise<void> {
  const accessToken = await getAccessToken();
  const meta = await getSyncFileMeta(accessToken, fileId);
  const bytes = await downloadSyncFile(accessToken, fileId);
  await writeDbBytes(bytes);
  useSettingsStore.getState().setDriveSyncMeta({
    driveFileId: fileId,
    lastSyncedRemoteModifiedTime: meta.modifiedTime,
    lastSyncedAt: new Date().toISOString(),
    lastSyncedByDeviceName: meta.appProperties?.lastSyncDeviceName ?? null,
  });
  useSettingsStore.getState().setSyncPending(false);
  await relaunch();
}

/** User's explicit choice on first connect: this PC's data becomes the cloud version. */
export async function pushLocalAsInitial(existingFileId: string | null): Promise<void> {
  const accessToken = await getAccessToken();
  const bytes = await readDbBytes();
  const schemaVersion = await getLocalSchemaVersion();
  const { deviceId, deviceName } = useSettingsStore.getState();
  const now = new Date().toISOString();
  const meta = await uploadSyncFile(accessToken, existingFileId, bytes, {
    lastSyncDeviceId: deviceId,
    lastSyncDeviceName: deviceName,
    lastSyncAt: now,
    dbSchemaVersion: String(schemaVersion),
  });
  useSettingsStore.getState().setDriveSyncMeta({
    driveFileId: meta.id,
    lastSyncedRemoteModifiedTime: meta.modifiedTime,
    lastSyncedAt: now,
    lastSyncedByDeviceName: deviceName,
  });
  useSettingsStore.getState().setSyncPending(false);
}

export async function disconnectGoogleDrive(): Promise<void> {
  await vault.clearRefreshToken();
  useSettingsStore.getState().disconnectDriveSync();
  useSyncUiStore.getState().setPendingRemoteChange(null);
  useSyncUiStore.getState().setSchemaBlocked(false);
}

// ---------------------------------------------------------------------------
// The sync tick — cloud always wins; pulling is gated behind explicit user
// confirmation (see ApplySyncModal) rather than applied silently.
// ---------------------------------------------------------------------------

let ticking = false;

export async function runSyncTick(): Promise<void> {
  const settings = useSettingsStore.getState();
  if (!settings.driveSyncEnabled) return;
  if (ticking) return;
  if (useSyncUiStore.getState().pendingRemoteChange) return; // awaiting user confirmation

  ticking = true;
  try {
    const refreshToken = await vault.getRefreshToken();
    if (!refreshToken) return;
    const accessToken = (await refreshAccessToken(refreshToken)).accessToken;

    const fileId = useSettingsStore.getState().driveFileId;
    if (!fileId) return;

    const remote = await getSyncFileMeta(accessToken, fileId);
    const remoteSchema = Number(remote.appProperties?.dbSchemaVersion ?? "0");

    if (remoteSchema > CURRENT_SCHEMA_VERSION) {
      useSyncUiStore.getState().setSchemaBlocked(true);
      return;
    }
    useSyncUiStore.getState().setSchemaBlocked(false);

    const s = useSettingsStore.getState();
    const remoteChanged = remote.modifiedTime !== s.lastSyncedRemoteModifiedTime;

    if (remoteChanged) {
      // Never interrupt an in-progress sale — retry on the next tick instead.
      if (useCartStore.getState().items.length > 0) return;
      useSyncUiStore.getState().setPendingRemoteChange({
        fileId,
        remoteModifiedTime: remote.modifiedTime,
        deviceName: remote.appProperties?.lastSyncDeviceName ?? null,
        syncedAt: remote.appProperties?.lastSyncAt ?? null,
      });
      return;
    }

    const localSchema = await getLocalSchemaVersion();
    const schemaJustAdvanced =
      String(localSchema) !== (remote.appProperties?.dbSchemaVersion ?? "");

    if (s.syncPending || schemaJustAdvanced) {
      const bytes = await readDbBytes();
      const now = new Date().toISOString();
      const meta = await uploadSyncFile(accessToken, fileId, bytes, {
        lastSyncDeviceId: s.deviceId,
        lastSyncDeviceName: s.deviceName,
        lastSyncAt: now,
        dbSchemaVersion: String(localSchema),
      });
      useSettingsStore.getState().setDriveSyncMeta({
        driveFileId: meta.id,
        lastSyncedRemoteModifiedTime: meta.modifiedTime,
        lastSyncedAt: now,
        lastSyncedByDeviceName: s.deviceName,
      });
      useSettingsStore.getState().setSyncPending(false);
    }
  } catch {
    // Network/API errors are expected in an offline-first app; just retry next tick.
  } finally {
    ticking = false;
  }
}

/** Manual "Sincronizar ahora" button. */
export async function syncNow(): Promise<void> {
  await runSyncTick();
}

/** Applies a confirmed pending remote change: download, replace, relaunch. */
export async function applyPendingRemoteChange(): Promise<void> {
  const pending = useSyncUiStore.getState().pendingRemoteChange;
  if (!pending) return;
  const accessToken = await getAccessToken();
  const bytes = await downloadSyncFile(accessToken, pending.fileId);
  await writeDbBytes(bytes);
  useSettingsStore.getState().setDriveSyncMeta({
    lastSyncedRemoteModifiedTime: pending.remoteModifiedTime,
    lastSyncedAt: new Date().toISOString(),
    lastSyncedByDeviceName: pending.deviceName,
  });
  useSettingsStore.getState().setSyncPending(false);
  useSyncUiStore.getState().setPendingRemoteChange(null);
  await relaunch();
}

/** "Ahora no" — dismiss the modal; the same change will be offered again next tick. */
export function postponePendingRemoteChange(): void {
  useSyncUiStore.getState().setPendingRemoteChange(null);
}

export function startSyncLoop(intervalMs = 5 * 60 * 1000): () => void {
  const id = setInterval(() => {
    runSyncTick().catch(() => {});
  }, intervalMs);
  return () => clearInterval(id);
}
