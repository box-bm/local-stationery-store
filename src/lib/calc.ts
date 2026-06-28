// Pure sale/stock calculations, kept framework-free so they are easy to test.

/** Subtotal for a single cart line. */
export function lineSubtotal(price: number, quantity: number): number {
  return price * quantity;
}

/** Sum of all cart lines. */
export function cartTotal(
  items: { sellUnit: { sell_price: number }; quantity: number }[]
): number {
  return items.reduce(
    (sum, it) => sum + lineSubtotal(it.sellUnit.sell_price, it.quantity),
    0
  );
}

/** Profit for a single cart line: revenue minus the cost of the base units sold. */
export function lineProfit(
  sellPrice: number,
  purchasePrice: number,
  quantityInBaseUnits: number,
  quantity: number
): number {
  return (sellPrice - purchasePrice * quantityInBaseUnits) * quantity;
}

/** Sum of all cart lines' profit. */
export function cartProfit(
  items: {
    product: { purchase_price: number };
    sellUnit: { sell_price: number; quantity_in_base_units: number };
    quantity: number;
  }[]
): number {
  return items.reduce(
    (sum, it) =>
      sum +
      lineProfit(
        it.sellUnit.sell_price,
        it.product.purchase_price,
        it.sellUnit.quantity_in_base_units,
        it.quantity
      ),
    0
  );
}

/**
 * Base-unit stock consumed by selling `quantity` of a sell unit. Follows the
 * simplified rule: deduct `quantity_in_base_units * quantity`.
 */
export function stockDeducted(
  quantityInBaseUnits: number,
  quantity: number
): number {
  return quantityInBaseUnits * quantity;
}

/** Remaining stock after a hypothetical sale (may be negative). */
export function stockAfter(
  currentStock: number,
  quantityInBaseUnits: number,
  quantity: number
): number {
  return currentStock - stockDeducted(quantityInBaseUnits, quantity);
}
