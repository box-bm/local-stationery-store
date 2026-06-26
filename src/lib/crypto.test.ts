import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./crypto";

describe("crypto", () => {
  it("produces a deterministic 64-char hex digest", async () => {
    const a = await hashPassword("1234");
    const b = await hashPassword("1234");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different digests for different inputs", async () => {
    expect(await hashPassword("1234")).not.toBe(await hashPassword("12345"));
  });

  it("verifies a matching password", async () => {
    const hash = await hashPassword("secret-pin");
    expect(await verifyPassword("secret-pin", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
