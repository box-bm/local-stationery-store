import { useEffect, useState } from "react";
import { CheckCircle2, Banknote, CreditCard, Smartphone } from "lucide-react";
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
import { useCartStore } from "@/stores/cart";
import { completeSale } from "@/services/db";
import { useAppStore } from "@/stores/app";
import { toast } from "@/stores/toast";
import { useT, type TranslationKey } from "@/i18n";
import { formatQ, cn } from "@/lib/utils";
import type { CartItem } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

const PAYMENT_METHODS: { id: string; labelKey: TranslationKey; icon: typeof Banknote }[] = [
  { id: "cash", labelKey: "checkout.cash", icon: Banknote },
  { id: "card", labelKey: "checkout.card", icon: CreditCard },
  { id: "transfer", labelKey: "checkout.transfer", icon: Smartphone },
];

type Phase = "confirm" | "done";

export function CheckoutModal({ open, onClose }: Props) {
  const t = useT();
  const { items, total, clear } = useCartStore();
  const refreshLowStock = useAppStore((s) => s.refreshLowStock);

  const [phase, setPhase] = useState<Phase>("confirm");
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [saving, setSaving] = useState(false);

  // Snapshot of the sale for the receipt (cart is cleared on success).
  const [receipt, setReceipt] = useState<{
    id: number;
    total: number;
    items: CartItem[];
    method: string;
    change: number | null;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setPhase("confirm");
      setMethod("cash");
      setNotes("");
      setCashReceived("");
    }
  }, [open]);

  const totalValue = total();
  const cashNum = Number(cashReceived) || 0;
  const change = method === "cash" && cashNum > 0 ? cashNum - totalValue : null;

  async function handleConfirm() {
    if (saving || !items.length) return;
    setSaving(true);
    try {
      const snapshot = [...items];
      const res = await completeSale(snapshot, method, notes || undefined);
      setReceipt({
        id: res.saleId,
        total: res.total,
        items: snapshot,
        method,
        change: method === "cash" && cashNum > 0 ? cashNum - res.total : null,
      });
      clear();
      await refreshLowStock();
      setPhase("done");
      toast.success(t("checkout.saleRegistered", { id: res.saleId }));
    } catch (e) {
      toast.error(t("checkout.saleError", { error: String(e) }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md"
        hideClose={phase === "done"}
        onKeyDown={(e) => {
          if (e.key === "Enter" && phase === "confirm") {
            e.preventDefault();
            handleConfirm();
          }
        }}
      >
        {phase === "confirm" ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("checkout.title")}</DialogTitle>
              <DialogDescription>
                {t("checkout.itemsInCart", { count: items.length })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  {t("checkout.totalToPay")}
                </p>
                <p className="text-4xl font-bold">{formatQ(totalValue)}</p>
              </div>

              <div className="space-y-1.5">
                <Label>{t("checkout.paymentMethod")}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((m) => {
                    const Icon = m.icon;
                    const active = method === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setMethod(m.id)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border p-3 text-xs font-medium transition-colors",
                          active
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-accent"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        {t(m.labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {method === "cash" && (
                <div className="space-y-1.5">
                  <Label htmlFor="cash">{t("checkout.cashReceived")}</Label>
                  <Input
                    id="cash"
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                  />
                  {change !== null && (
                    <p
                      className={cn(
                        "text-sm",
                        change < 0 ? "text-destructive" : "text-muted-foreground"
                      )}
                    >
                      {change < 0
                        ? t("checkout.missing", { amount: formatQ(-change) })
                        : t("checkout.change", { amount: formatQ(change) })}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="notes">{t("checkout.notes")}</Label>
                <Input
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("checkout.notesPlaceholder")}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={saving}>
                {t("common.cancel")}
              </Button>
              <Button variant="success" onClick={handleConfirm} disabled={saving}>
                {saving
                  ? t("common.saving")
                  : t("checkout.charge", { amount: formatQ(totalValue) })}
              </Button>
            </DialogFooter>
          </>
        ) : (
          receipt && (
            <>
              <DialogHeader>
                <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-success/15">
                  <CheckCircle2 className="h-7 w-7 text-success" />
                </div>
                <DialogTitle className="text-center">
                  {t("checkout.completed")}
                </DialogTitle>
                <DialogDescription className="text-center">
                  {t("checkout.receipt", { id: receipt.id })}
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-lg border border-border">
                <ul className="divide-y divide-border">
                  {receipt.items.map((it, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        {it.quantity}× {it.product.name}
                        <span className="text-muted-foreground">
                          {" "}
                          ({it.sellUnit.name})
                        </span>
                      </span>
                      <span className="font-medium">
                        {formatQ(it.sellUnit.sell_price * it.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="space-y-1 border-t border-border px-3 py-2">
                  <div className="flex justify-between font-semibold">
                    <span>{t("common.total")}</span>
                    <span>{formatQ(receipt.total)}</span>
                  </div>
                  {receipt.change !== null && receipt.change >= 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{t("checkout.changeLabel")}</span>
                      <span>{formatQ(receipt.change)}</span>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button className="w-full" size="lg" onClick={onClose}>
                  {t("checkout.newSale")}
                </Button>
              </DialogFooter>
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
