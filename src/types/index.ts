// TypeScript interfaces mirroring the SQLite schema.

export interface Product {
  id: string;
  name: string;
  description: string | null;
  barcode: string | null;
  category: string | null;
  base_unit_name: string;
  base_unit_quantity: number;
  purchase_price: number;
  stock: number;
  min_stock: number;
  created_at: string;
  updated_at: string;
}

export interface SellUnit {
  id: string;
  product_id: string;
  name: string;
  quantity_in_base_units: number;
  sell_price: number;
  is_default: number; // 0 | 1
  created_at: string;
}

/** A product together with all of its sell units. */
export interface ProductWithUnits extends Product {
  sell_units: SellUnit[];
}

export interface Sale {
  id: string;
  /** Sequential, human-facing sale number (receipts, sales list, exports) — not a sync identity. */
  sale_number: number;
  total: number;
  payment_method: string;
  payment_reference: string | null;
  customer_id: string | null;
  customer_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  sell_unit_id: string;
  product_name: string;
  sell_unit_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  cost_total: number;
}

export interface SaleWithItems extends Sale {
  items: SaleItem[];
  item_count: number;
}

export type SalesSegmentGranularity = "day" | "week" | "month" | "year";

export interface SalesSegment {
  period: string;
  count: number;
  total: number;
  profit: number;
}

export type StockMovementType = "purchase" | "sale" | "adjustment";

export interface StockMovement {
  id: string;
  product_id: string;
  type: StockMovementType;
  quantity: number;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
  // Joined for reporting convenience.
  product_name?: string;
}

/** A line item in the in-progress sale (cart). */
export interface CartItem {
  product: Product;
  sellUnit: SellUnit;
  quantity: number;
}

/** Payload shapes used when creating/updating products. */
export interface SellUnitInput {
  name: string;
  quantity_in_base_units: number;
  sell_price: number;
  is_default: boolean;
}

export interface ProductInput {
  name: string;
  description?: string | null;
  barcode?: string | null;
  category?: string | null;
  base_unit_name: string;
  base_unit_quantity: number;
  purchase_price: number;
  stock: number;
  min_stock: number;
  sell_units: SellUnitInput[];
}
