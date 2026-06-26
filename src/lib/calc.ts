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
