import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));

import { fetch } from "@tauri-apps/plugin-http";
import {
  requestDeviceCode,
  pollForToken,
  refreshAccessToken,
  GoogleAuthError,
  type DeviceCodeInfo,
} from "./googleAuth";

const mockFetch = vi.mocked(fetch);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

const INFO: DeviceCodeInfo = {
  deviceCode: "dev",
  userCode: "ABCD-EFGH",
  verificationUrl: "https://www.google.com/device",
  expiresInSec: 60,
  intervalSec: 5,
};

beforeEach(() => mockFetch.mockReset());

describe("requestDeviceCode", () => {
  it("maps Google's response to DeviceCodeInfo", async () => {
    mockFetch.mockResolvedValue(
      json({
        device_code: "dev",
        user_code: "ABCD-EFGH",
        verification_url: "https://www.google.com/device",
        expires_in: 1800,
        interval: 5,
      })
    );
    await expect(requestDeviceCode()).resolves.toEqual({ ...INFO, expiresInSec: 1800 });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/device/code");
    expect(String(init?.body)).toContain("drive.file");
  });

  it("includes Google's error detail on failure", async () => {
    mockFetch.mockResolvedValue(json({ error: "invalid_client", error_description: "bad" }, 401));
    await expect(requestDeviceCode()).rejects.toThrow("invalid_client: bad");
  });
});

describe("pollForToken", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function run(promise: Promise<unknown>) {
    // Surface rejections without an unhandled-rejection warning while timers advance.
    const settled = promise.then(
      (v) => ({ ok: true as const, v }),
      (e) => ({ ok: false as const, e })
    );
    await vi.runAllTimersAsync();
    return settled;
  }

  it("keeps polling while authorization is pending, then returns tokens", async () => {
    mockFetch
      .mockResolvedValueOnce(json({ error: "authorization_pending" }, 428))
      .mockResolvedValueOnce(json({ access_token: "a", refresh_token: "r", expires_in: 3599 }));
    const onTick = vi.fn();

    const res = await run(pollForToken(INFO, onTick));
    expect(res).toEqual({ ok: true, v: { accessToken: "a", refreshToken: "r", expiresInSec: 3599 } });
    expect(onTick).toHaveBeenCalledTimes(2);
  });

  it("backs off by 5s on slow_down", async () => {
    mockFetch
      .mockResolvedValueOnce(json({ error: "slow_down" }, 428))
      .mockResolvedValueOnce(json({ access_token: "a", refresh_token: "r", expires_in: 1 }));
    const p = pollForToken(INFO);

    await vi.advanceTimersByTimeAsync(5000);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(9999);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    await expect(p).resolves.toMatchObject({ accessToken: "a" });
  });

  it.each([
    ["access_denied", "Conexión cancelada"],
    ["expired_token", "El código expiró"],
    ["invalid_grant", "invalid_grant"],
  ])("fails with a GoogleAuthError on %s", async (error, message) => {
    mockFetch.mockResolvedValue(json({ error }, 400));
    const res = await run(pollForToken(INFO));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.e).toBeInstanceOf(GoogleAuthError);
      expect((res.e as Error).message).toContain(message);
    }
  });

  it("gives up once the device code expires", async () => {
    mockFetch.mockImplementation(async () => json({ error: "authorization_pending" }, 428));
    const res = await run(pollForToken({ ...INFO, expiresInSec: 12 }));
    expect(res.ok).toBe(false);
    expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(3);
  });
});

describe("refreshAccessToken", () => {
  it("returns a fresh access token", async () => {
    mockFetch.mockResolvedValue(json({ access_token: "new", expires_in: 3600 }));
    await expect(refreshAccessToken("r")).resolves.toEqual({ accessToken: "new", expiresInSec: 3600 });
    expect(String(mockFetch.mock.calls[0][1]?.body)).toContain("grant_type=refresh_token");
  });

  it("falls back to the HTTP status when the error body isn't JSON", async () => {
    mockFetch.mockResolvedValue(new Response("oops", { status: 503 }));
    await expect(refreshAccessToken("r")).rejects.toThrow("HTTP 503");
  });
});
