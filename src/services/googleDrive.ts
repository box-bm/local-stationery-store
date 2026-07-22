import { fetch } from "@tauri-apps/plugin-http";

// Minimal Google Drive API v3 client, scoped to the single sync file this
// app manages (scope: drive.file — the app can only see files it created).

export const SYNC_FILE_NAME = "libreria_sync.db";

export interface DriveFileMeta {
  id: string;
  modifiedTime: string;
  appProperties?: Record<string, string>;
}

class GoogleDriveError extends Error {}

function authHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

/** Finds this app's sync file if one already exists (e.g. a second device connecting). */
export async function findExistingSyncFile(
  accessToken: string
): Promise<DriveFileMeta | null> {
  const params = new URLSearchParams({
    q: `name = '${SYNC_FILE_NAME}' and trashed = false`,
    spaces: "drive",
    fields: "files(id,modifiedTime,appProperties)",
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new GoogleDriveError(`No se pudo buscar el archivo en Drive (${res.status})`);
  }
  const data = await res.json();
  const files = data.files as DriveFileMeta[] | undefined;
  return files && files.length ? files[0] : null;
}

/** Cheap metadata-only check, used on every sync tick. */
export async function getSyncFileMeta(
  accessToken: string,
  fileId: string
): Promise<DriveFileMeta> {
  const params = new URLSearchParams({ fields: "id,modifiedTime,appProperties" });
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?${params}`,
    { headers: authHeaders(accessToken) }
  );
  if (!res.ok) {
    throw new GoogleDriveError(`No se pudo leer el archivo de Drive (${res.status})`);
  }
  return res.json();
}

/**
 * Creates (fileId = null) or overwrites (fileId set) the sync file's
 * content and appProperties in a single multipart request.
 */
export async function uploadSyncFile(
  accessToken: string,
  fileId: string | null,
  bytes: Uint8Array,
  appProperties: Record<string, string>
): Promise<DriveFileMeta> {
  const boundary = `libreria-pos-${crypto.randomUUID()}`;
  const metadata = { name: SYNC_FILE_NAME, appProperties };
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
    bytes as BlobPart,
    `\r\n--${boundary}--`,
  ]);

  const params = new URLSearchParams({
    uploadType: "multipart",
    fields: "id,modifiedTime,appProperties",
  });
  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?${params}`
    : `https://www.googleapis.com/upload/drive/v3/files?${params}`;

  const res = await fetch(url, {
    method: fileId ? "PATCH" : "POST",
    headers: {
      ...authHeaders(accessToken),
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) {
    throw new GoogleDriveError(`No se pudo subir el archivo a Drive (${res.status})`);
  }
  return res.json();
}

export async function downloadSyncFile(
  accessToken: string,
  fileId: string
): Promise<Uint8Array> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: authHeaders(accessToken) }
  );
  if (!res.ok) {
    throw new GoogleDriveError(`No se pudo descargar el archivo de Drive (${res.status})`);
  }
  return new Uint8Array(await res.arrayBuffer());
}
