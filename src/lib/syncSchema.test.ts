import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type FakeDatabase } from "@/test/sqlite";

let current: FakeDatabase;
vi.mock("@/services/db", () => ({ getDb: async () => current }));

import { getLocalSchemaVersion, CURRENT_SCHEMA_VERSION } from "./syncSchema";

describe("getLocalSchemaVersion", () => {
  beforeEach(async () => {
    current = await createTestDb({ seed: false });
  });

  it("reads the version seeded by the latest migration", async () => {
    await expect(getLocalSchemaVersion()).resolves.toBe(CURRENT_SCHEMA_VERSION);
  });

  it("returns 0 when no version has been recorded", async () => {
    await current.execute("DELETE FROM app_meta");
    await expect(getLocalSchemaVersion()).resolves.toBe(0);
  });
});
