import { useEffect, useMemo, useState } from "react";
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
import { useT } from "@/i18n";
import { formatQ, formatStock, cn } from "@/lib/utils";
import type { ProductWithUnits, SellUnit } from "@/types";

interface Props {
  product: ProductWithUnits | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (sellUnit: SellUnit, quantity: number) => void;
}

export function SellUnitModal({ product, open, onClose, onConfirm }: Props) {
  const t = useT();
  const [unitId, setUnitId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState("1");

  // Reset selection when the product changes.
  useEffect(() => {
    if (product) {
      const def =
        product.sell_units.find((u) => u.is_default) ?? product.sell_units[0];
      setUnitId(def?.id ?? null);
      setQuantity("1");
    }
  }, [product]);

  const selectedUnit = useMemo(
    () => product?.sell_units.find((u) => u.id === unitId) ?? null,
    [product, unitId]
  );

  const qtyNum = Math.max(1, Math.floor(Number(quantity) || 0));
  const subtotal = selectedUnit ? selectedUnit.sell_price * qtyNum : 0;

  // How much stock (in base units) this would consume.
  const stockNeeded = selectedUnit
    ? selectedUnit.quantity_in_base_units * qtyNum
    : 0;
  const stockAfter = product ? product.stock - stockNeeded : 0;
  const insufficient = product ? stockNeeded > product.stock : false;

  if (!product) return null;

  function confirm() {
    if (!selectedUnit) return;
    onConfirm(selectedUnit, qtyNum);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !insufficient) {
            e.preventDefault();
            confirm();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>
            {t("pos.stock")}: {formatStock(product.stock)} {product.base_unit_name}
            {" · "}
            {t("unit.chooseUnit")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-2">
            {product.sell_units.map((u) => {
              const active = u.id === unitId;
              return (
                <button
                  key={u.id}
                  onClick={() => setUnitId(u.id)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-accent"
                  )}
                >
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("unit.eachIn", {
                        qty: formatStock(u.quantity_in_base_units),
                        base: product.base_unit_name,
                      })}
                    </p>
                  </div>
                  <span className="font-semibold">{formatQ(u.sell_price)}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qty">{t("common.quantity")}</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() =>
                  setQuantity(String(Math.max(1, qtyNum - 1)))
                }
              >
                −
              </Button>
              <Input
                id="qty"
                type="number"
                min={1}
                value={quantity}
                autoFocus
                onFocus={(e) => e.target.select()}
                onChange={(e) => setQuantity(e.target.value)}
                className="text-center text-lg"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQuantity(String(qtyNum + 1))}
              >
                +
              </Button>
            </div>
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("common.subtotal")}</span>
              <span className="text-lg font-bold">{formatQ(subtotal)}</span>
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>{t("unit.remaining")}</span>
              <span className={cn(insufficient && "text-destructive font-medium")}>
                {formatStock(stockAfter)} {product.base_unit_name}
              </span>
            </div>
          </div>

          {insufficient && (
            <p className="text-sm text-destructive">{t("unit.insufficient")}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={confirm} disabled={insufficient || !selectedUnit}>
            {t("unit.addToCart")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
