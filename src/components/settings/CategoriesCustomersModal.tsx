import { useEffect, useState } from "react";
import { Pencil, Trash2, Merge, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import { toast } from "@/stores/toast";
import {
  listCategoriesWithCounts,
  renameCategory,
  deleteCategory,
  mergeCategories,
  listCustomersWithCounts,
  renameCustomer,
  deleteCustomer,
  mergeCustomers,
  type CategoryWithCount,
  type CustomerWithCount,
} from "@/services/db";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = "categories" | "customers";

export function CategoriesCustomersModal({ open, onClose }: Props) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("categories");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("settings.manageCatalog")}</DialogTitle>
        </DialogHeader>

        <div className="inline-flex w-fit rounded-lg border border-border p-0.5">
          <TabButton active={tab === "categories"} onClick={() => setTab("categories")}>
            {t("common.category")}
          </TabButton>
          <TabButton active={tab === "customers"} onClick={() => setTab("customers")}>
            {t("sales.customer")}
          </TabButton>
        </div>

        {tab === "categories" ? <CategoriesPanel /> : <CustomersPanel />}
      </DialogContent>
    </Dialog>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

function CategoriesPanel() {
  const t = useT();
  const [items, setItems] = useState<CategoryWithCount[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [mergeTarget, setMergeTarget] = useState("");

  async function refresh() {
    setItems(await listCategoriesWithCounts());
  }
  useEffect(() => {
    refresh();
  }, []);

  function startEdit(c: CategoryWithCount) {
    setEditing(c.category);
    setEditValue(c.category);
  }

  async function saveEdit() {
    if (!editing) return;
    const name = editValue.trim();
    if (!name) return;
    if (name !== editing) {
      await renameCategory(editing, name);
      toast.success(t("settings.catalogSaved"));
    }
    setEditing(null);
    refresh();
  }

  async function remove(c: CategoryWithCount) {
    if (!confirm(t("settings.deleteCategoryConfirm", { name: c.category, count: c.count })))
      return;
    await deleteCategory(c.category);
    toast.success(t("settings.catalogSaved"));
    setSelected((s) => s.filter((x) => x !== c.category));
    refresh();
  }

  function toggleSelect(name: string) {
    setSelected((s) =>
      s.includes(name) ? s.filter((x) => x !== name) : [...s, name]
    );
  }

  async function doMerge() {
    if (selected.length < 2 || !mergeTarget) return;
    await mergeCategories(selected, mergeTarget);
    toast.success(t("settings.catalogMerged"));
    setSelected([]);
    setMergeTarget("");
    refresh();
  }

  return (
    <div className="space-y-3">
      <div className="max-h-80 space-y-1 overflow-y-auto rounded-md border border-border p-2">
        {items.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            {t("settings.catalogEmpty")}
          </p>
        ) : (
          items.map((c) => (
            <div
              key={c.category}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50"
            >
              <input
                type="checkbox"
                checked={selected.includes(c.category)}
                onChange={() => toggleSelect(c.category)}
                className="h-4 w-4"
              />
              {editing === c.category ? (
                <>
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                    autoFocus
                    className="h-8 flex-1"
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveEdit}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setEditing(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 truncate text-sm">{c.category}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("settings.catalogCount", { count: c.count })}
                  </span>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => remove(c)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {selected.length >= 2 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/5 p-3">
          <Merge className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{t("settings.mergeInto")}</span>
          <select
            value={mergeTarget}
            onChange={(e) => setMergeTarget(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">{t("settings.mergeChoose")}</option>
            {selected.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button size="sm" disabled={!mergeTarget} onClick={doMerge}>
            {t("settings.mergeAction")}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

function CustomersPanel() {
  const t = useT();
  const [items, setItems] = useState<CustomerWithCount[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [mergeTarget, setMergeTarget] = useState<number | "">("");

  async function refresh() {
    setItems(await listCustomersWithCounts());
  }
  useEffect(() => {
    refresh();
  }, []);

  function startEdit(c: CustomerWithCount) {
    setEditing(c.id);
    setEditValue(c.name);
  }

  async function saveEdit() {
    if (editing == null) return;
    const name = editValue.trim();
    if (!name) return;
    await renameCustomer(editing, name);
    toast.success(t("settings.catalogSaved"));
    setEditing(null);
    refresh();
  }

  async function remove(c: CustomerWithCount) {
    if (!confirm(t("settings.deleteCustomerConfirm", { name: c.name, count: c.sale_count })))
      return;
    await deleteCustomer(c.id);
    toast.success(t("settings.catalogSaved"));
    setSelected((s) => s.filter((x) => x !== c.id));
    refresh();
  }

  function toggleSelect(id: number) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function doMerge() {
    if (selected.length < 2 || mergeTarget === "") return;
    await mergeCustomers(selected, mergeTarget);
    toast.success(t("settings.catalogMerged"));
    setSelected([]);
    setMergeTarget("");
    refresh();
  }

  return (
    <div className="space-y-3">
      <div className="max-h-80 space-y-1 overflow-y-auto rounded-md border border-border p-2">
        {items.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            {t("settings.catalogEmpty")}
          </p>
        ) : (
          items.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50"
            >
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={() => toggleSelect(c.id)}
                className="h-4 w-4"
              />
              {editing === c.id ? (
                <>
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                    autoFocus
                    className="h-8 flex-1"
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveEdit}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setEditing(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 truncate text-sm">{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("settings.catalogSales", { count: c.sale_count })}
                  </span>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => remove(c)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {selected.length >= 2 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/5 p-3">
          <Merge className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{t("settings.mergeInto")}</span>
          <select
            value={mergeTarget}
            onChange={(e) => setMergeTarget(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">{t("settings.mergeChoose")}</option>
            {items
              .filter((i) => selected.includes(i.id))
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
          </select>
          <Button size="sm" disabled={mergeTarget === ""} onClick={doMerge}>
            {t("settings.mergeAction")}
          </Button>
        </div>
      )}
    </div>
  );
}
