import { invoke } from "@tauri-apps/api/core";

// The Google Drive OAuth refresh token is stored in the OS-native
// credential store (Windows Credential Manager / macOS Keychain / Linux
// Secret Service) via the keyring_* commands in src-tauri/src/lib.rs — a
// narrow, security-motivated exception to this project's "no custom Rust
// commands" rule. See the note in CLAUDE.md.

const SERVICE = "libreria-pos-drive-sync";
const ACCOUNT = "refresh_token";

export async function getRefreshToken(): Promise<string | null> {
  return invoke<string | null>("keyring_get", {
    service: SERVICE,
    account: ACCOUNT,
  });
}

export async function setRefreshToken(token: string): Promise<void> {
  await invoke("keyring_set", {
    service: SERVICE,
    account: ACCOUNT,
    secret: token,
  });
}

export async function clearRefreshToken(): Promise<void> {
  await invoke("keyring_delete", { service: SERVICE, account: ACCOUNT });
}
