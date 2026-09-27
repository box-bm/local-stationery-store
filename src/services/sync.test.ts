import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: vi.fn(async () => new Uint8Array([1, 2, 3])),
  writeFile: vi.fn(async () => {}),
  exists: vi.fn(async () => true),
  remove: vi.fn(async () => {}),
}));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn(async () => {}) }));
vi.mock("./db", () => ({
  getDb: async () => ({ execute: vi.fn(async () => {}) }),
}));
vi.mock("./system", () => ({ getDbPath: async () => "/data/libreria.db" }));
vi.mock("./vault", () => ({
  getRefreshToken: vi.fn(async () => "refresh-token"),
  setRefreshToken: vi.fn(async () => {}),
  clearRefreshToken: vi.fn(async () => {}),
}));
vi.mock("./googleAuth", () => ({
  requestDeviceCode: vi.fn(),
  pollForToken: vi.fn(),
  refreshAccessToken: vi.fn(async () => ({ accessToken: "access", expiresInSec: 3600 })),
}));
vi.mock("./googleDrive", () => ({
  findExistingSyncFile: vi.fn(),
  getSyncFileMeta: vi.fn(),
  uploadSyncFile: vi.fn(),
  downloadSyncFile: vi.fn(async () => new Uint8Array([9, 9])),
}));
vi.mock("@/lib/syncSchema", () => ({
  CURRENT_SCHEMA_VERSION: 6,
  getLocalSchemaVersion: vi.fn(async () => 6),
}));

import * as fs from "@tauri-apps/plugin-fs";
import { relaunch } from "@tauri-apps/plugin-process";
import * as vault from "./vault";
import * as drive from "./googleDrive";
import * as auth from "./googleAuth";
import { getLocalSchemaVersion } from "@/lib/syncSchema";
import {
  runSyncTick,
  applyPendingRemoteChange,
  postponePendingRemoteChange,
  disconnectGoogleDrive,
  connectGoogleDrive,
  pushLocalAsInitial,
  useSyncUiStore,
} from "./sync";
import { useSettingsStore } from "@/stores/settings";
import { useCartStore } from "@/stores/cart";
import type { Product, SellUnit } from "@/types";

const SYNCED_TIME = "2026-09-01T10:00:00.000Z";

function remoteMeta(overrides: Partial<{ modifiedTime: string; schema: string }> = {}) {
  return {
    id: "file-1",
    modifiedTime: overrides.modifiedTime ?? SYNCED_TIME,
    appProperties: {
      dbSchemaVersion: overrides.schema ?? "6",
      lastSyncDeviceName: "Caja 2",
      lastSyncAt: "2026-09-01T10:00:00.000Z",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useSyncUiStore.setState({ pendingRemoteChange: null, schemaBlocked: false });
  useCartStore.getState().clear();
  useSettingsStore.setState({
    driveSyncEnabled: true,
    driveFileId: "file-1",
    lastSyncedRemoteModifiedTime: SYNCED_TIME,
    syncPending: false,
    deviceId: "dev-1",
    deviceName: "Caja 1",
  });
  vi.mocked(drive.getSyncFileMeta).mockResolvedValue(remoteMeta());
  vi.mocked(drive.uploadSyncFile).mockResolvedValue({
    id: "file-1",
    modifiedTime: "2026-09-02T00:00:00.000Z",
  });
});

describe("runSyncTick", () => {
  it("does nothing when sync is disabled", async () => {
    useSettingsStore.setState({ driveSyncEnabled: false });
    await runSyncTick();
    expect(vault.getRefreshToken).not.toHaveBeenCalled();
  });

  it("does nothing while a remote change awaits confirmation", async () => {
    useSyncUiStore.setState({
      pendingRemoteChange: { fileId: "f", remoteModifiedTime: "t", deviceName: null, syncedAt: null },
    });
    await runSyncTick();
    expect(drive.getSyncFileMeta).not.toHaveBeenCalled();
  });

  it("does nothing without a stored refresh token", async () => {
    vi.mocked(vault.getRefreshToken).mockResolvedValueOnce(null);
    await runSyncTick();
    expect(drive.getSyncFileMeta).not.toHaveBeenCalled();
  });

  it("blocks sync when the cloud schema is newer than this build", async () => {
    vi.mocked(drive.getSyncFileMeta).mockResolvedValue(remoteMeta({ schema: "7" }));
    await runSyncTick();
    expect(useSyncUiStore.getState().schemaBlocked).toBe(true);
    expect(drive.uploadSyncFile).not.toHaveBeenCalled();
    expect(useSyncUiStore.getState().pendingRemoteChange).toBeNull();
  });

  it("offers a newer remote version instead of applying it silently", async () => {
    useSyncUiStore.setState({ schemaBlocked: true });
    vi.mocked(drive.getSyncFileMeta).mockResolvedValue(
      remoteMeta({ modifiedTime: "2026-09-05T00:00:00.000Z" })
    );
    useSettingsStore.setState({ syncPending: true });

    await runSyncTick();

    expect(useSyncUiStore.getState().schemaBlocked).toBe(false);
    expect(useSyncUiStore.getState().pendingRemoteChange).toEqual({
      fileId: "file-1",
      remoteModifiedTime: "2026-09-05T00:00:00.000Z",
      deviceName: "Caja 2",
      syncedAt: "2026-09-01T10:00:00.000Z",
    });
    // Cloud wins: local changes are not pushed over a diverged remote.
    expect(drive.uploadSyncFile).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it("never interrupts a sale in progress", async () => {
    vi.mocked(drive.getSyncFileMeta).mockResolvedValue(
      remoteMeta({ modifiedTime: "2026-09-05T00:00:00.000Z" })
    );
    useCartStore.getState().addItem(
      { id: "p", purchase_price: 1 } as Product,
      { id: "u", sell_price: 1, quantity_in_base_units: 1 } as SellUnit,
      1
    );
    await runSyncTick();
    expect(useSyncUiStore.getState().pendingRemoteChange).toBeNull();
  });

  it("uploads local changes when the remote hasn't diverged", async () => {
    useSettingsStore.setState({ syncPending: true });
    await runSyncTick();

    expect(drive.uploadSyncFile).toHaveBeenCalledWith(
      "access",
      "file-1",
      new Uint8Array([1, 2, 3]),
      expect.objectContaining({
        lastSyncDeviceId: "dev-1",
        lastSyncDeviceName: "Caja 1",
        dbSchemaVersion: "6",
      })
    );
    const s = useSettingsStore.getState();
    expect(s.syncPending).toBe(false);
    expect(s.lastSyncedRemoteModifiedTime).toBe("2026-09-02T00:00:00.000Z");
    expect(s.lastSyncedByDeviceName).toBe("Caja 1");
  });

  it("uploads when the local schema advanced even without pending changes", async () => {
    vi.mocked(drive.getSyncFileMeta).mockResolvedValue(remoteMeta({ schema: "5" }));
    await runSyncTick();
    expect(drive.uploadSyncFile).toHaveBeenCalledOnce();
  });

  it("is idle when nothing changed on either side", async () => {
    await runSyncTick();
    expect(drive.uploadSyncFile).not.toHaveBeenCalled();
    expect(useSyncUiStore.getState().pendingRemoteChange).toBeNull();
  });

  it("swallows network errors so the next tick can retry", async () => {
    vi.mocked(auth.refreshAccessToken).mockRejectedValueOnce(new Error("offline"));
    await expect(runSyncTick()).resolves.toBeUndefined();
    // Not stuck in the "ticking" state afterwards.
    useSettingsStore.setState({ syncPending: true });
    await runSyncTick();
    expect(drive.uploadSyncFile).toHaveBeenCalledOnce();
  });
});

describe("pending remote change", () => {
  const pending = {
    fileId: "file-1",
    remoteModifiedTime: "2026-09-05T00:00:00.000Z",
    deviceName: "Caja 2",
    syncedAt: null,
  };

  it("applyPendingRemoteChange replaces the DB, clears WAL sidecars and relaunches", async () => {
    useSyncUiStore.setState({ pendingRemoteChange: pending });
    await applyPendingRemoteChange();

    expect(fs.writeFile).toHaveBeenCalledWith("/data/libreria.db", new Uint8Array([9, 9]));
    expect(fs.remove).toHaveBeenCalledWith("/data/libreria.db-wal");
    expect(fs.remove).toHaveBeenCalledWith("/data/libreria.db-shm");
    expect(useSettingsStore.getState().lastSyncedRemoteModifiedTime).toBe(pending.remoteModifiedTime);
    expect(useSyncUiStore.getState().pendingRemoteChange).toBeNull();
    expect(relaunch).toHaveBeenCalled();
  });

  it("applyPendingRemoteChange is a no-op without a pending change", async () => {
    await applyPendingRemoteChange();
    expect(drive.downloadSyncFile).not.toHaveBeenCalled();
  });

  it("postponePendingRemoteChange dismisses the prompt", () => {
    useSyncUiStore.setState({ pendingRemoteChange: pending });
    postponePendingRemoteChange();
    expect(useSyncUiStore.getState().pendingRemoteChange).toBeNull();
  });
});

describe("connect / disconnect", () => {
  it("connectGoogleDrive stores the refresh token in the keyring", async () => {
    const info = { deviceCode: "d", userCode: "ABCD", verificationUrl: "u", expiresInSec: 60, intervalSec: 5 };
    vi.mocked(auth.requestDeviceCode).mockResolvedValue(info);
    vi.mocked(auth.pollForToken).mockResolvedValue({ accessToken: "a", refreshToken: "r", expiresInSec: 1 });
    vi.mocked(drive.findExistingSyncFile).mockResolvedValue(null);
    const onCode = vi.fn();

    await expect(connectGoogleDrive(onCode)).resolves.toEqual({ existing: null });
    expect(onCode).toHaveBeenCalledWith(info);
    expect(vault.setRefreshToken).toHaveBeenCalledWith("r");
  });

  it("pushLocalAsInitial creates the cloud file from local data", async () => {
    useSettingsStore.setState({ driveFileId: null, syncPending: true });
    vi.mocked(getLocalSchemaVersion).mockResolvedValueOnce(6);
    await pushLocalAsInitial(null);
    expect(drive.uploadSyncFile).toHaveBeenCalledWith(
      "access",
      null,
      expect.any(Uint8Array),
      expect.objectContaining({ dbSchemaVersion: "6" })
    );
    expect(useSettingsStore.getState().driveFileId).toBe("file-1");
    expect(useSettingsStore.getState().syncPending).toBe(false);
  });

  it("disconnectGoogleDrive clears the token and sync state", async () => {
    useSyncUiStore.setState({ schemaBlocked: true });
    await disconnectGoogleDrive();
    expect(vault.clearRefreshToken).toHaveBeenCalled();
    expect(useSettingsStore.getState()).toMatchObject({
      driveSyncEnabled: false,
      driveFileId: null,
    });
    expect(useSyncUiStore.getState().schemaBlocked).toBe(false);
  });
});
