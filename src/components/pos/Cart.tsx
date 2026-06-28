import { Trash2, Plus, Minus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cart";
import { useT } from "@/i18n";
import { formatQ } from "@/lib/utils";

interface Props {
  onCheckout: () => void;
}

export function Cart({ onCheckout }: Props) {
  const t = useT();
  const { items, removeItem, updateQuantity, clear, total, profit } =
    useCartStore();
  const isEmpty = items.length === 0;

  return (
    <div className="flex h-full w-[88vw] max-w-[360px] shrink-0 flex-col border-l border-border bg-card lg:w-[360px]">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 pl-12 lg:pl-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShoppingCart className="h-4 w-4" />
          {t("pos.cart")}
        </h2>
        {!isEmpty && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clear}
            className="text-muted-foreground"
          >
            {t("pos.empty")}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <ShoppingCart className="mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm">{t("pos.cartEmpty")}</p>
            <p className="text-xs">{t("pos.cartEmptyHint")}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li
                key={`${item.product.id}-${item.sellUnit.id}`}
                className="rounded-lg border border-border bg-background p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {item.product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.sellUnit.name} · {formatQ(item.sellUnit.sell_price)}
                    </p>
                  </div>
                  <button
                    onClick={() => removeItem(i)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(i, item.quantity - 1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(i, item.quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <span className="text-sm font-semibold">
                    {formatQ(item.sellUnit.sell_price * item.quantity)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border p-4">
        <div className="mb-1 flex items-end justify-between">
          <span className="text-sm text-muted-foreground">{t("common.total")}</span>
          <span className="text-3xl font-bold">{formatQ(total())}</span>
        </div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {t("pos.cartProfit")}
          </span>
          <span className="text-sm font-semibold text-emerald-600">
            {formatQ(profit())}
          </span>
        </div>
        <Button
          size="xl"
          variant="success"
          className="w-full"
          disabled={isEmpty}
          onClick={onCheckout}
        >
          {t("pos.completeSale")}
        </Button>
      </div>
    </div>
  );
}
