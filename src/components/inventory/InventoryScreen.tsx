import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  FileSpreadsheet,
  PackagePlus,
  Pencil,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { ProductFormModal } from "./ProductFormModal";
import { RestockModal } from "./RestockModal";
import { useDebounce } from "@/hooks/useDebounce";
import {
  listProducts,
  listCategories,
  deleteProduct,
  getSellUnits,
} from "@/services/db";
import { exportInventory } from "@/services/excel";
import { useAppStore } from "@/stores/app";
import { toast } from "@/stores/toast";
import { useT } from "@/i18n";
import { formatQ, formatStock, cn } from "@/lib/utils";
import type { Product } from "@/types";

interface Row extends Product {
  default_price: number | null;
  default_unit: string | null;
  unit_count: number;
}

export function InventoryScreen() {
  const t = useT();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 200);
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);

  const refreshLowStock = useAppStore((s) => s.refreshLowStock);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const products = await listProducts(debounced);
      const withUnits: Row[] = [];
      for (const p of products) {
        const units = await getSellUnits(p.id);
        const def = units.find((u) => u.is_default) ?? units[0];
        withUnits.push({
          ...p,
          default_price: def?.sell_price ?? null,
          default_unit: def?.name ?? null,
          unit_count: units.length,
        });
      }
      setRows(withUnits);
      setCategories(await listCategories());
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () =>
      rows.filter(
        (p) =>
          (!category || p.category === category) &&
          (!onlyLow || p.stock <= p.min_stock)
      ),
    [rows, category, onlyLow]
  );

  function openNew() {
    setEditId(null);
    setFormOpen(true);
  }
  function openEdit(id: number) {
    setEditId(id);
    setFormOpen(true);
  }

  async function handleDelete(p: Product) {
    if (!confirm(t("inv.deleteConfirm", { name: p.name }))) return;
    try {
      await deleteProduct(p.id);
      toast.success(t("inv.deleted"));
      await load();
      await refreshLowStock();
    } catch (e) {
      toast.error(t("inv.deleteError", { error: String(e) }));
    }
  }

  async function handleExport() {
    try {
      const ok = await exportInventory();
      if (ok) toast.success(t("inv.exported"));
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function afterSave() {
    await load();
    await refreshLowStock();
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-4 md:px-6">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("inv.searchPlaceholder")}
            className="pl-9"
          />
        </div>

        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-auto min-w-[160px]"
        >
          <option value="">{t("inv.allCategories")}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>

        <Button
          variant={onlyLow ? "warning" : "outline"}
          onClick={() => setOnlyLow((v) => !v)}
        >
          <AlertTriangle className="h-4 w-4" /> {t("inv.onlyLowStock")}
        </Button>

        <Button variant="outline" onClick={handleExport}>
          <FileSpreadsheet className="h-4 w-4" /> {t("common.export")}
        </Button>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> {t("inv.newProduct")}
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t("inv.product")}</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  {t("common.category")}
                </th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">
                  {t("inv.code")}
                </th>
                <th className="px-4 py-3 font-medium">{t("common.price")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("inv.stock")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("inv.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    {t("common.loading")}
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    {t("inv.empty")}
                  </td>
                </tr>
              ) : (
                visible.map((p) => {
                  const low = p.stock <= p.min_stock;
                  return (
                    <tr key={p.id} className="hover:bg-accent/40">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openEdit(p.id)}
                          className="text-left font-medium hover:text-primary"
                        >
                          {p.name}
                        </button>
                        <p className="text-xs text-muted-foreground">
                          {t("inv.unitsOfSale", {
                            count: p.unit_count,
                            base: p.base_unit_name,
                          })}
                        </p>
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        {p.category || "—"}
                      </td>
                      <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground lg:table-cell">
                        {p.barcode || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {p.default_price != null ? (
                          <>
                            {formatQ(p.default_price)}
                            <span className="text-xs text-muted-foreground">
                              {" "}
                              / {p.default_unit}
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {low && (
                            <Badge variant="warning" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {t("inv.lowStock")}
                            </Badge>
                          )}
                          <span className={cn(low && "font-semibold text-warning")}>
                            {formatStock(p.stock)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t("inv.restock")}
                            onClick={() => setRestockTarget(p)}
                          >
                            <PackagePlus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t("common.edit")}
                            onClick={() => openEdit(p.id)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t("common.delete")}
                            onClick={() => handleDelete(p)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProductFormModal
        open={formOpen}
        productId={editId}
        categories={categories}
        onClose={() => setFormOpen(false)}
        onSaved={afterSave}
      />

      <RestockModal
        product={restockTarget}
        open={!!restockTarget}
        onClose={() => setRestockTarget(null)}
        onSaved={afterSave}
      />
    </div>
  );
}
