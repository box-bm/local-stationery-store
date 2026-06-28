import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ScanLine, Package, ShoppingCart, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import { StockBadge, StockAlertBanner } from "@/components/shared/StockAlerts";
import { Cart } from "./Cart";
import { SellUnitModal } from "./SellUnitModal";
import { CheckoutModal } from "./CheckoutModal";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { useDebounce } from "@/hooks/useDebounce";
import {
  searchProductsWithUnits,
  getProductByBarcode,
  listCategories,
  getSalesSummary,
} from "@/services/db";
import { useCartStore } from "@/stores/cart";
import { toast } from "@/stores/toast";
import { useT } from "@/i18n";
import { stockStatus } from "@/lib/stock";
import { formatQ, formatStock } from "@/lib/utils";
import type { ProductWithUnits, SellUnit } from "@/types";

export function POSScreen() {
  const t = useT();
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 200);
  const [results, setResults] = useState<ProductWithUnits[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selected, setSelected] = useState<ProductWithUnits | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false); // overlay on narrow screens
  const [todayProfit, setTodayProfit] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const addItem = useCartStore((s) => s.addItem);
  const cartCount = useCartStore((s) => s.count());
  const cartTotal = useCartStore((s) => s.total());

  // Load search results.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await searchProductsWithUnits(debounced, 100);
      if (!cancelled) setResults(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  useEffect(() => {
    listCategories().then(setCategories);
    searchRef.current?.focus();
  }, []);

  // Refresh today's profit on mount and whenever the checkout closes (sale completed).
  useEffect(() => {
    if (checkoutOpen) return;
    const today = new Date();
    const tz = today.getTimezoneOffset() * 60000;
    const iso = new Date(today.getTime() - tz).toISOString().slice(0, 10);
    getSalesSummary({ from: iso, to: iso }).then((s) => setTodayProfit(s.profit));
  }, [checkoutOpen]);

  const visible = useMemo(
    () =>
      selectedCats.length
        ? results.filter((p) => p.category && selectedCats.includes(p.category))
        : results,
    [results, selectedCats]
  );

  // Barcode scanner: look up by barcode and add the default unit directly.
  useBarcodeScanner({
    enabled: !selected && !checkoutOpen,
    onScan: async (code) => {
      try {
        const product = await getProductByBarcode(code);
        if (!product) {
          toast.warning(t("pos.scanNoMatch", { code }));
          return;
        }
        const unit =
          product.sell_units.find((u) => u.is_default) ?? product.sell_units[0];
        if (!unit) {
          toast.error(t("pos.noUnits", { name: product.name }));
          return;
        }
        addItem(product, unit, 1);
        toast.success(t("pos.scannedAdded", { name: product.name, unit: unit.name }));
        setQuery("");
      } catch (e) {
        toast.error(t("pos.scanError", { error: String(e) }));
      }
    },
  });

  function handleConfirmUnit(sellUnit: SellUnit, quantity: number) {
    if (!selected) return;
    addItem(selected, sellUnit, quantity);
    toast.success(t("pos.addedToCart", { name: selected.name }));
    setSelected(null);
    setQuery("");
    searchRef.current?.focus();
  }

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Search bar */}
        <div className="border-b border-border bg-card px-4 py-4 md:px-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("pos.searchPlaceholder")}
              className="h-14 pl-12 pr-12 text-base md:text-lg"
            />
            <ScanLine className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            {/* Category filter — multi-select dropdown */}
            {categories.length > 0 && (
              <MultiSelect
                className="w-56"
                label={t("pos.categories")}
                allLabel={t("pos.allCategories")}
                clearLabel={t("common.clear")}
                options={categories}
                selected={selectedCats}
                onChange={setSelectedCats}
              />
            )}

            <div className="rounded-lg border border-border bg-background px-3 py-1.5">
              <p className="text-xs text-muted-foreground">{t("pos.todayProfit")}</p>
              <p className="text-sm font-bold text-primary">{formatQ(todayProfit)}</p>
            </div>
          </div>
        </div>

        {/* Results grid — pb-24 on small screens reserves space for the floating cart FAB */}
        <div className="flex-1 overflow-y-auto p-4 pb-24 md:p-6 lg:pb-6">
          <StockAlertBanner className="mb-4" />
          {visible.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <Package className="mb-3 h-12 w-12 opacity-30" />
              <p>{t("pos.noProducts")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {visible.map((p) => {
                const def =
                  p.sell_units.find((u) => u.is_default) ?? p.sell_units[0];
                const out = stockStatus(p.stock, p.min_stock) === "out";
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p)}
                    disabled={out}
                    className="flex flex-col rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-primary hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 sm:p-4"
                  >
                    {/* Name gets full width — no competing badge */}
                    <p className="mb-1 line-clamp-2 font-medium leading-tight">
                      {p.name}
                    </p>
                    {p.category && (
                      <span className="mb-2 text-xs text-muted-foreground">
                        {p.category}
                      </span>
                    )}
                    <div className="mt-auto pt-2">
                      <p className="text-base font-bold text-primary sm:text-lg">
                        {def ? formatQ(def.sell_price) : "—"}
                        {def && (
                          <span className="text-xs font-normal text-muted-foreground">
                            {" "}
                            / {def.name}
                          </span>
                        )}
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-1">
                        <p className="text-xs text-muted-foreground">
                          {formatStock(p.stock)} {p.base_unit_name}
                        </p>
                        <StockBadge stock={p.stock} minStock={p.min_stock} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cart — inline on wide screens */}
      <div className="hidden lg:flex">
        <Cart onCheckout={() => setCheckoutOpen(true)} />
      </div>

      {/* Cart — floating button + slide-over on narrow screens */}
      <button
        onClick={() => setCartOpen(true)}
        className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-primary-foreground shadow-lg lg:hidden"
      >
        <ShoppingCart className="h-5 w-5" />
        <span className="font-semibold">{formatQ(cartTotal)}</span>
        {cartCount > 0 && (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary-foreground px-1.5 text-xs font-bold text-primary">
            {cartCount}
          </span>
        )}
      </button>

      {cartOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setCartOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full">
            <div className="relative h-full">
              <button
                onClick={() => setCartOpen(false)}
                className="absolute left-3 top-3 z-10 rounded-md p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
              <Cart
                onCheckout={() => {
                  setCartOpen(false);
                  setCheckoutOpen(true);
                }}
              />
            </div>
          </div>
        </div>
      )}

      <SellUnitModal
        product={selected}
        open={!!selected}
        onClose={() => {
          setSelected(null);
          searchRef.current?.focus();
        }}
        onConfirm={handleConfirmUnit}
      />

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => {
          setCheckoutOpen(false);
          searchRef.current?.focus();
        }}
      />
    </div>
  );
}
