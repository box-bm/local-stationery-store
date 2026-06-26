import { AlertTriangle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores/app";
import { useT } from "@/i18n";
import { stockStatus } from "@/lib/stock";
import { cn } from "@/lib/utils";

/** A single product's stock badge (warning for low, error for out). */
export function StockBadge({
  stock,
  minStock,
  className,
}: {
  stock: number;
  minStock: number;
  className?: string;
}) {
  const t = useT();
  const status = stockStatus(stock, minStock);
  if (status === "ok") return null;
  if (status === "out") {
    return (
      <Badge variant="destructive" className={cn("gap-1", className)}>
        <XCircle className="h-3 w-3" />
        {t("stock.outTitle")}
      </Badge>
    );
  }
  return (
    <Badge variant="warning" className={cn("gap-1", className)}>
      <AlertTriangle className="h-3 w-3" />
      {t("stock.lowTitle")}
    </Badge>
  );
}

/**
 * Centralized stock alert banner driven by the app store counts: an error row
 * when products are out of stock, a warning row when products are low.
 */
export function StockAlertBanner({ className }: { className?: string }) {
  const t = useT();
  const { lowStockCount, outOfStockCount, setScreen } = useAppStore();

  if (!lowStockCount && !outOfStockCount) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {outOfStockCount > 0 && (
        <button
          onClick={() => setScreen("inventory")}
          className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-card px-3 py-2 text-left text-sm"
        >
          <XCircle className="h-4 w-4 shrink-0 text-destructive" />
          <span>{t("stock.outAlert", { n: outOfStockCount })}</span>
        </button>
      )}
      {lowStockCount > 0 && (
        <button
          onClick={() => setScreen("inventory")}
          className="flex items-center gap-2 rounded-lg border border-warning/40 bg-card px-3 py-2 text-left text-sm"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <span>{t("stock.lowAlert", { n: lowStockCount })}</span>
        </button>
      )}
    </div>
  );
}
