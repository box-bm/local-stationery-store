import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { restockProduct, adjustStock } from "@/services/db";
import { toast } from "@/stores/toast";
import { useSettingsStore } from "@/stores/settings";
import { useT } from "@/i18n";
import { formatStock } from "@/lib/utils";
import type { Product } from "@/types";

interface Props {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type Mode = "add" | "set";

export function RestockModal({ product, open, onClose, onSaved }: Props) {
  const t = useT();
  const sym = useSettingsStore((s) => s.currencySymbol);
  const [mode, setMode] = useState<Mode>("add");
  const [amount, setAmount] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && product) {
      setMode("add");
      setAmount("");
      setPurchasePrice(String(product.purchase_price));
      setNotes("");
    }
  }, [open, product]);

  if (!product) return null;

  async function handleSave() {
    if (!product) return;
    const value = Number(amount);
    if (mode === "add" && (!value || value <= 0)) {
      toast.error(t("restock.errPositive"));
      return;
    }
    if (mode === "set" && value < 0) {
      toast.error(t("restock.errNegative"));
      return;
    }
    setSaving(true);
    try {
      if (mode === "add") {
        const price = purchasePrice ? Number(purchasePrice) : undefined;
        await restockProduct(product.id, value, price, notes || undefined);
        toast.success(
          t("restock.added", {
            qty: formatStock(value),
            base: product.base_unit_name,
          })
        );
      } else {
        await adjustStock(product.id, value, notes || undefined);
        toast.success(t("restock.adjusted"));
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(t("restock.error", { error: String(e) }));
    } finally {
      setSaving(false);
    }
  }

  const projected =
    mode === "add"
      ? product.stock + (Number(amount) || 0)
      : Number(amount) || 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSave();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>
            {t("restock.stockNow", {
              stock: formatStock(product.stock),
              base: product.base_unit_name,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === "add" ? "default" : "outline"}
              onClick={() => setMode("add")}
            >
              {t("restock.addStock")}
            </Button>
            <Button
              type="button"
              variant={mode === "set" ? "default" : "outline"}
              onClick={() => setMode("set")}
            >
              {t("restock.setStock")}
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amount">
              {mode === "add"
                ? t("restock.amountToAdd", { base: product.base_unit_name })
                : t("restock.newStock", { base: product.base_unit_name })}
            </Label>
            <Input
              id="amount"
              type="number"
              step="any"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>

          {mode === "add" && (
            <div className="space-y-1.5">
              <Label htmlFor="pp">{t("restock.purchasePrice", { sym })}</Label>
              <Input
                id="pp"
                type="number"
                step="any"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="rnotes">{t("restock.notes")}</Label>
            <Input
              id="rnotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                mode === "add"
                  ? t("restock.addNotePlaceholder")
                  : t("restock.setNotePlaceholder")
              }
            />
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("restock.resulting")}</span>
              <span className="font-semibold">
                {formatStock(projected)} {product.base_unit_name}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
