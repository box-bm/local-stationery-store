import { describe, it, expect } from "vitest";
import { translate } from "@/i18n";
import { es } from "./locales/es";
import { en } from "./locales/en";

describe("translate", () => {
  it("returns the string for a known key", () => {
    expect(translate("es", "common.save")).toBe("Guardar");
    expect(translate("en", "common.save")).toBe("Save");
  });

  it("interpolates variables", () => {
    const out = translate("es", "checkout.receipt", { id: 7 });
    expect(out).toContain("7");
    expect(out).not.toContain("{id}");
  });

  it("leaves unknown placeholders intact but does not throw", () => {
    const out = translate("en", "checkout.receipt", {});
    expect(out).toContain("{id}");
  });

  it("falls back to the key when missing", () => {
    // @ts-expect-error intentionally invalid key
    expect(translate("es", "does.not.exist")).toBe("does.not.exist");
  });
});

describe("locale parity", () => {
  it("es and en define exactly the same keys", () => {
    const esKeys = Object.keys(es).sort();
    const enKeys = Object.keys(en).sort();
    expect(enKeys).toEqual(esKeys);
  });

  it("no translation value is empty", () => {
    for (const [key, value] of Object.entries({ ...es, ...en })) {
      expect(value, `empty value for ${key}`).not.toBe("");
    }
  });
});
