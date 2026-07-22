import { fetch } from "@tauri-apps/plugin-http";

// Google OAuth 2.0 Device Authorization Grant (RFC 8628). Chosen over a
// loopback-redirect PKCE flow because it needs no local HTTP listener and no
// extra (non-official) Tauri plugin — just this plugin-http fetch plus the
// system browser (opened via @tauri-apps/plugin-opener from the UI). The
// tradeoff is that the token exchange needs a client secret embedded in the
// build; scope is limited to drive.file to bound the blast radius.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
const SCOPE = "https://www.googleapis.com/auth/drive.file";

export class GoogleAuthError extends Error {}

export interface DeviceCodeInfo {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresInSec: number;
  intervalSec: number;
}

export interface TokenResult {
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extracts Google's `error`/`error_description` from a failed response body. */
async function errorDetail(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return [data.error, data.error_description].filter(Boolean).join(": ");
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function requestDeviceCode(): Promise<DeviceCodeInfo> {
  const res = await fetch("https://oauth2.googleapis.com/device/code", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, scope: SCOPE }).toString(),
  });
  if (!res.ok) {
    throw new GoogleAuthError(
      `No se pudo iniciar la conexión con Google (${await errorDetail(res)})`
    );
  }
  const data = await res.json();
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUrl: data.verification_url,
    expiresInSec: data.expires_in,
    intervalSec: data.interval,
  };
}

/**
 * Polls Google's token endpoint until the user approves the device code (or
 * it's denied/expired). `onTick` fires before every poll attempt so the UI
 * can show a countdown/spinner.
 */
export async function pollForToken(
  info: DeviceCodeInfo,
  onTick?: () => void
): Promise<TokenResult> {
  let intervalMs = info.intervalSec * 1000;
  const deadline = Date.now() + info.expiresInSec * 1000;

  while (Date.now() < deadline) {
    await sleep(intervalMs);
    onTick?.();

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        device_code: info.deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }).toString(),
    });
    const data = await res.json();

    if (res.ok) {
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresInSec: data.expires_in,
      };
    }
    if (data.error === "authorization_pending") continue;
    if (data.error === "slow_down") {
      intervalMs += 5000;
      continue;
    }
    if (data.error === "access_denied") {
      throw new GoogleAuthError("Conexión cancelada");
    }
    if (data.error === "expired_token") {
      throw new GoogleAuthError("El código expiró, intenta de nuevo");
    }
    throw new GoogleAuthError(
      [data.error, data.error_description].filter(Boolean).join(": ") ||
        `HTTP ${res.status}`
    );
  }
  throw new GoogleAuthError("El código expiró, intenta de nuevo");
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresInSec: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) {
    throw new GoogleAuthError(
      `No se pudo renovar la sesión de Google (${await errorDetail(res)})`
    );
  }
  const data = await res.json();
  return { accessToken: data.access_token, expiresInSec: data.expires_in };
}
