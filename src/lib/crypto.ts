// Lightweight password hashing for the optional app lock.
// NOTE: this is basic deterrence for a shop counter, not strong security —
// the data itself is not encrypted. Do not rely on it to protect secrets.

const SALT = "libreria-pos::v1";

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(SALT + password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return (await hashPassword(password)) === hash;
}
