// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));

import { fetch } from "@tauri-apps/plugin-http";
import {
  findExistingSyncFile,
  getSyncFileMeta,
  uploadSyncFile,
  downloadSyncFile,
  SYNC_FILE_NAME,
} from "./googleDrive";

const mockFetch = vi.mocked(fetch);
const META = { id: "f1", modifiedTime: "2026-09-01T00:00:00Z", appProperties: { a: "1" } };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => mockFetch.mockReset());

describe("googleDrive", () => {
  it("findExistingSyncFile queries by name and returns the first match", async () => {
    mockFetch.mockResolvedValue(json({ files: [META] }));
    await expect(findExistingSyncFile("tok")).resolves.toEqual(META);

    const [url, init] = mockFetch.mock.calls[0];
    expect(decodeURIComponent(String(url)).replace(/\+/g, " ")).toContain(
      `name = '${SYNC_FILE_NAME}' and trashed = false`
    );
    expect(init?.headers).toMatchObject({ Authorization: "Bearer tok" });
  });

  it("findExistingSyncFile returns null when there is no file", async () => {
    mockFetch.mockResolvedValue(json({ files: [] }));
    await expect(findExistingSyncFile("tok")).resolves.toBeNull();
  });

  it("getSyncFileMeta throws on HTTP errors", async () => {
    mockFetch.mockResolvedValue(json({}, 404));
    await expect(getSyncFileMeta("tok", "f1")).rejects.toThrow("(404)");
  });

  it("uploadSyncFile creates with POST when there is no file id", async () => {
    mockFetch.mockResolvedValue(json(META));
    await uploadSyncFile("tok", null, new Uint8Array([1]), { k: "v" });
    const [url, init] = mockFetch.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(String(url)).toMatch(/\/upload\/drive\/v3\/files\?/);
  });

  it("uploadSyncFile overwrites with PATCH and sends metadata + bytes as multipart", async () => {
    mockFetch.mockResolvedValue(json(META));
    await expect(
      uploadSyncFile("tok", "f1", new Uint8Array([65, 66]), { dbSchemaVersion: "6" })
    ).resolves.toEqual(META);

    const [url, init] = mockFetch.mock.calls[0];
    expect(init?.method).toBe("PATCH");
    expect(String(url)).toContain("/files/f1?");
    const contentType = (init?.headers as Record<string, string>)["Content-Type"];
    const boundary = contentType.match(/boundary=(.+)$/)![1];

    const body = await (init?.body as Blob).text();
    expect(body).toContain(`--${boundary}\r\nContent-Type: application/json`);
    expect(body).toContain(JSON.stringify({ name: SYNC_FILE_NAME, appProperties: { dbSchemaVersion: "6" } }));
    expect(body).toContain("\r\n\r\nAB\r\n");
    expect(body.endsWith(`--${boundary}--`)).toBe(true);
  });

  it("downloadSyncFile returns the file bytes", async () => {
    mockFetch.mockResolvedValue(new Response(new Uint8Array([7, 8, 9])));
    await expect(downloadSyncFile("tok", "f1")).resolves.toEqual(new Uint8Array([7, 8, 9]));
    expect(String(mockFetch.mock.calls[0][0])).toContain("alt=media");
  });
});
