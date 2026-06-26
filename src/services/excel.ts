import * as XLSX from "xlsx";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import {
  getSellUnits,
  getSaleItems,
  listProducts,
  listSales,
  listStockMovements,
  type DateRange,
} from "./db";
import { formatDateTime } from "@/lib/utils";

/** Build a workbook into a Uint8Array, prompt for a path, and write it. */
async function saveWorkbook(
  wb: XLSX.WorkBook,
  defaultName: string
): Promise<boolean> {
  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: "Excel", extensions: ["xlsx"] }],
  });
  if (!path) return false; // user cancelled

  const data = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  await writeFile(path, new Uint8Array(data));
  return true;
}

function autoWidth(rows: Record<string, unknown>[]): XLSX.ColInfo[] {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((k) => {
    const maxLen = Math.max(
      k.length,
      ...rows.map((r) => String(r[k] ?? "").length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
  });
}

function sheetFromRows(
  wb: XLSX.WorkBook,
  name: string,
  rows: Record<string, unknown>[]
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = autoWidth(rows);
  XLSX.utils.book_append_sheet(wb, ws, name);
}

const stamp = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Inventory report
// ---------------------------------------------------------------------------

export async function exportInventory(): Promise<boolean> {
  const products = await listProducts();
  const wb = XLSX.utils.book_new();

  const productRows: Record<string, unknown>[] = [];
  const unitRows: Record<string, unknown>[] = [];

  for (const p of products) {
    productRows.push({
      ID: p.id,
      Producto: p.name,
      Categoría: p.category ?? "",
      "Código de barras": p.barcode ?? "",
      "Unidad base": p.base_unit_name,
      "Cant. por paquete": p.base_unit_quantity,
      "Precio compra (Q)": p.purchase_price,
      "Stock (u. base)": p.stock,
      "Stock mínimo": p.min_stock,
      "Stock bajo": p.stock <= p.min_stock ? "SÍ" : "",
    });

    const units = await getSellUnits(p.id);
    for (const u of units) {
      unitRows.push({
        "Producto ID": p.id,
        Producto: p.name,
        "Unidad de venta": u.name,
        "Equivale a (u. base)": u.quantity_in_base_units,
        "Precio venta (Q)": u.sell_price,
        "Por defecto": u.is_default ? "SÍ" : "",
      });
    }
  }

  sheetFromRows(wb, "Inventario", productRows);
  sheetFromRows(wb, "Unidades de venta", unitRows);

  return saveWorkbook(wb, `inventario_${stamp()}.xlsx`);
}

// ---------------------------------------------------------------------------
// Sales report
// ---------------------------------------------------------------------------

export async function exportSales(range?: DateRange): Promise<boolean> {
  const sales = await listSales(range);
  const wb = XLSX.utils.book_new();

  const saleRows: Record<string, unknown>[] = [];
  const itemRows: Record<string, unknown>[] = [];

  for (const s of sales) {
    saleRows.push({
      "Venta #": s.id,
      Fecha: formatDateTime(s.created_at),
      Artículos: s.item_count,
      "Método de pago": s.payment_method,
      "Total (Q)": s.total,
      Notas: s.notes ?? "",
    });

    const items = await getSaleItems(s.id);
    for (const it of items) {
      itemRows.push({
        "Venta #": s.id,
        Fecha: formatDateTime(s.created_at),
        Producto: it.product_name,
        "Unidad de venta": it.sell_unit_name,
        Cantidad: it.quantity,
        "Precio unit. (Q)": it.unit_price,
        "Subtotal (Q)": it.subtotal,
      });
    }
  }

  sheetFromRows(wb, "Ventas", saleRows);
  sheetFromRows(wb, "Detalle", itemRows);

  return saveWorkbook(wb, `ventas_${stamp()}.xlsx`);
}

// ---------------------------------------------------------------------------
// Stock movements report
// ---------------------------------------------------------------------------

const MOVEMENT_LABEL: Record<string, string> = {
  purchase: "Entrada (compra)",
  sale: "Salida (venta)",
  adjustment: "Ajuste",
};

export async function exportStockMovements(
  range?: DateRange
): Promise<boolean> {
  const movements = await listStockMovements(range);
  const wb = XLSX.utils.book_new();

  const rows = movements.map((m) => ({
    ID: m.id,
    Fecha: formatDateTime(m.created_at),
    Producto: m.product_name ?? m.product_id,
    Tipo: MOVEMENT_LABEL[m.type] ?? m.type,
    "Cantidad (u. base)": m.quantity,
    "Ref. venta": m.reference_id ?? "",
    Notas: m.notes ?? "",
  }));

  sheetFromRows(wb, "Movimientos", rows);
  return saveWorkbook(wb, `movimientos_${stamp()}.xlsx`);
}
