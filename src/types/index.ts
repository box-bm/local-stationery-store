// TypeScript interfaces mirroring the SQLite schema.

export interface Product {
  id: number;
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
  id: number;
  product_id: number;
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
  id: number;
  total: number;
  payment_method: string;
  payment_reference: string | null;
  customer_id: number | null;
  customer_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface Customer {
  id: number;
  name: string;
  created_at: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  sell_unit_id: number;
  product_name: string;
  sell_unit_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface SaleWithItems extends Sale {
  items: SaleItem[];
  item_count: number;
}

export type StockMovementType = "purchase" | "sale" | "adjustment";

export interface StockMovement {
  id: number;
  product_id: number;
  type: StockMovementType;
  quantity: number;
  reference_id: number | null;
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
