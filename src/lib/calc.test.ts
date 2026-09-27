import { describe, it, expect } from "vitest";
import {
  lineSubtotal,
  cartTotal,
  lineProfit,
  cartProfit,
  stockDeducted,
  stockAfter,
} from "./calc";

describe("calc", () => {
  it("lineSubtotal multiplies price by quantity", () => {
    expect(lineSubtotal(2.5, 3)).toBe(7.5);
    expect(lineSubtotal(0, 10)).toBe(0);
  });

  it("cartTotal sums all lines", () => {
    const items = [
      { sellUnit: { sell_price: 0.25 }, quantity: 4 }, // 1.00
      { sellUnit: { sell_price: 7.5 }, quantity: 2 }, // 15.00
    ];
    expect(cartTotal(items)).toBe(16);
    expect(cartTotal([])).toBe(0);
  });

  it("stockDeducted follows quantity_in_base_units * quantity", () => {
    // selling 10 individual sheets of a 500-sheet ream deducts 0.02 reams
    expect(stockDeducted(0.002, 10)).toBeCloseTo(0.02, 10);
    expect(stockDeducted(1, 3)).toBe(3);
  });

  it("stockAfter subtracts the deducted amount", () => {
    expect(stockAfter(5, 1, 2)).toBe(3);
    expect(stockAfter(0.01, 0.002, 10)).toBeCloseTo(-0.01, 10); // can go negative
  });

  it("lineProfit subtracts the cost of the base units sold", () => {
    // ream costs Q40; a sheet is 1/500 of a ream and sells for Q0.25
    expect(lineProfit(0.25, 40, 0.002, 100)).toBeCloseTo(17, 10);
    expect(lineProfit(55, 40, 1, 2)).toBe(30);
    // selling below cost yields a loss
    expect(lineProfit(30, 40, 1, 1)).toBe(-10);
  });

  it("cartProfit sums the profit of every line", () => {
    const product = { purchase_price: 40 };
    const items = [
      { product, sellUnit: { sell_price: 55, quantity_in_base_units: 1 }, quantity: 2 }, // 30
      { product, sellUnit: { sell_price: 0.25, quantity_in_base_units: 0.002 }, quantity: 100 }, // 17
    ];
    expect(cartProfit(items)).toBeCloseTo(47, 10);
    expect(cartProfit([])).toBe(0);
  });
});
