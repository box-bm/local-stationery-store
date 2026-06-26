import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  listSales,
  getSaleItems,
  getSalesSummary,
  type DateRange,
} from "@/services/db";
import { exportSales } from "@/services/excel";
import { toast } from "@/stores/toast";
import { useT, type TranslationKey } from "@/i18n";
import { formatQ, formatDateTime, cn } from "@/lib/utils";
import type { SaleItem, SaleWithItems } from "@/types";

type Preset = "today" | "week" | "month" | "all" | "custom";

const PAYMENT_KEY: Record<string, TranslationKey> = {
  cash: "checkout.cash",
  card: "checkout.card",
  transfer: "checkout.transfer",
};

function localISO(d: Date): string {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function presetRange(preset: Preset): DateRange {
  const now = new Date();
  const today = localISO(now);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "week": {
      const day = now.getDay(); // 0=Sun
      const diff = (day + 6) % 7; // days since Monday
      const monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      return { from: localISO(monday), to: today };
    }
    case "month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: localISO(first), to: today };
    }
    default:
      return {};
  }
}

export function SalesScreen() {
  const t = useT();
  const [preset, setPreset] = useState<Preset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [summary, setSummary] = useState({ count: 0, total: 0 });
  const [expanded, setExpanded] = useState<number | null>(null);
  const [itemsCache, setItemsCache] = useState<Record<number, SaleItem[]>>({});
  const [loading, setLoading] = useState(true);

  const range: DateRange = useMemo(() => {
    if (preset === "custom") {
      return {
        from: customFrom || undefined,
        to: customTo || undefined,
      };
    }
    return presetRange(preset);
  }, [preset, customFrom, customTo]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, sum] = await Promise.all([
        listSales(range),
        getSalesSummary(range),
      ]);
      setSales(s);
      setSummary(sum);
      setExpanded(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleExpand(saleId: number) {
    if (expanded === saleId) {
      setExpanded(null);
      return;
    }
    setExpanded(saleId);
    if (!itemsCache[saleId]) {
      const items = await getSaleItems(saleId);
      setItemsCache((c) => ({ ...c, [saleId]: items }));
    }
  }

  async function handleExport() {
    try {
      const ok = await exportSales(range);
      if (ok) toast.success(t("sales.exported"));
    } catch (e) {
      toast.error(String(e));
    }
  }

  const presets: { id: Preset; labelKey: TranslationKey }[] = [
    { id: "today", labelKey: "sales.today" },
    { id: "week", labelKey: "sales.week" },
    { id: "month", labelKey: "sales.month" },
    { id: "all", labelKey: "sales.all" },
    { id: "custom", labelKey: "sales.custom" },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant={preset === p.id ? "default" : "outline"}
                onClick={() => setPreset(p.id)}
              >
                {t(p.labelKey)}
              </Button>
            ))}
          </div>

          {preset === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-auto"
              />
              <span className="text-muted-foreground">→</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-auto"
              />
            </div>
          )}

          <Button
            variant="outline"
            className="ml-auto"
            onClick={handleExport}
            disabled={!sales.length}
          >
            <FileSpreadsheet className="h-4 w-4" /> Exportar
          </Button>
        </div>

        {/* Summary */}
        <div className="mt-4 flex gap-4">
          <div className="rounded-lg border border-border bg-background px-4 py-2">
            <p className="text-xs text-muted-foreground">{t("sales.count")}</p>
            <p className="text-xl font-bold">{summary.count}</p>
          </div>
          <div className="rounded-lg border border-border bg-background px-4 py-2">
            <p className="text-xs text-muted-foreground">{t("common.total")}</p>
            <p className="text-xl font-bold text-primary">
              {formatQ(summary.total)}
            </p>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <p className="py-10 text-center text-muted-foreground">
            {t("common.loading")}
          </p>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Receipt className="mb-3 h-12 w-12 opacity-30" />
            <p>{t("sales.empty")}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-8 px-4 py-3" />
                  <th className="px-4 py-3 font-medium">{t("sales.sale")}</th>
                  <th className="px-4 py-3 font-medium">{t("sales.date")}</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">
                    {t("sales.customer")}
                  </th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">
                    {t("sales.payment")}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">{t("sales.items")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("common.total")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sales.map((s) => {
                  const isOpen = expanded === s.id;
                  return (
                    <Fragment key={s.id}>
                      <tr
                        onClick={() => toggleExpand(s.id)}
                        className={cn(
                          "cursor-pointer hover:bg-accent/40",
                          isOpen && "bg-accent/40"
                        )}
                      >
                        <td className="px-4 py-3 text-muted-foreground">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">#{s.id}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDateTime(s.created_at)}
                        </td>
                        <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                          {s.customer_name || "—"}
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <Badge variant="secondary">
                            {PAYMENT_KEY[s.payment_method]
                              ? t(PAYMENT_KEY[s.payment_method])
                              : s.payment_method}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">{s.item_count}</td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {formatQ(s.total)}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={`${s.id}-detail`} className="bg-muted/30">
                          <td />
                          <td colSpan={6} className="px-4 py-3">
                            <div className="rounded-md border border-border bg-background">
                              <table className="w-full text-sm">
                                <tbody className="divide-y divide-border">
                                  {(itemsCache[s.id] ?? []).map((it) => (
                                    <tr key={it.id}>
                                      <td className="px-3 py-2">
                                        {it.product_name}
                                        <span className="text-muted-foreground">
                                          {" "}
                                          · {it.sell_unit_name}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-right text-muted-foreground">
                                        {it.quantity} × {formatQ(it.unit_price)}
                                      </td>
                                      <td className="px-3 py-2 text-right font-medium">
                                        {formatQ(it.subtotal)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {(s.customer_name ||
                                s.payment_reference ||
                                s.notes) && (
                                <div className="space-y-0.5 border-t border-border px-3 py-2 text-xs text-muted-foreground">
                                  {s.customer_name && (
                                    <p>
                                      {t("sales.customer")}: {s.customer_name}
                                    </p>
                                  )}
                                  {s.payment_reference && (
                                    <p>
                                      {t("checkout.reference")}:{" "}
                                      {s.payment_reference}
                                    </p>
                                  )}
                                  {s.notes && <p>{t("sales.note", { note: s.notes })}</p>}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
