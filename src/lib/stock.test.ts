import { describe, it, expect } from "vitest";
import { stockStatus, countStock } from "./stock";

describe("stockStatus", () => {
  it("returns 'out' when stock is zero or below", () => {
    expect(stockStatus(0, 5)).toBe("out");
    expect(stockStatus(-1, 5)).toBe("out");
  });

  it("returns 'low' when at or below the minimum but above zero", () => {
    expect(stockStatus(5, 5)).toBe("low");
    expect(stockStatus(2, 5)).toBe("low");
    expect(stockStatus(0.5, 1)).toBe("low");
  });

  it("returns 'ok' when above the minimum", () => {
    expect(stockStatus(6, 5)).toBe("ok");
    expect(stockStatus(10, 0)).toBe("ok");
  });
});

describe("countStock", () => {
  it("tallies low and out counts", () => {
    const products = [
      { stock: 0, min_stock: 5 }, // out
      { stock: 3, min_stock: 5 }, // low
      { stock: 5, min_stock: 5 }, // low
      { stock: 20, min_stock: 5 }, // ok
      { stock: -2, min_stock: 0 }, // out
    ];
    expect(countStock(products)).toEqual({ low: 2, out: 2 });
  });

  it("handles an empty list", () => {
    expect(countStock([])).toEqual({ low: 0, out: 0 });
  });
});
