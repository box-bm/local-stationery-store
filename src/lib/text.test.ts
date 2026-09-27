import { describe, it, expect } from "vitest";
import { normalizeText, fuzzyIncludes } from "./text";

describe("normalizeText", () => {
  it("strips diacritics and lowercases", () => {
    expect(normalizeText("Lápiz Número Dos")).toBe("lapiz numero dos");
    expect(normalizeText("CUADERNO ÑANDÚ")).toBe("cuaderno nandu");
  });
});

describe("fuzzyIncludes", () => {
  it("matches regardless of accents or case, in both directions", () => {
    expect(fuzzyIncludes("Papel bond", "PAPÉL")).toBe(true);
    expect(fuzzyIncludes("Papél bond", "papel")).toBe(true);
    expect(fuzzyIncludes("Borrador", "lapiz")).toBe(false);
  });

  it("treats null/undefined/empty haystacks as no match", () => {
    expect(fuzzyIncludes(null, "a")).toBe(false);
    expect(fuzzyIncludes(undefined, "a")).toBe(false);
    expect(fuzzyIncludes("", "a")).toBe(false);
  });
});
