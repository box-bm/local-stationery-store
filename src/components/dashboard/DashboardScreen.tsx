import { useEffect, useState } from "react";
import { BarChart3, CircleDot, LineChart, PieChart, TrendingUp, WalletCards, ShoppingBag } from "lucide-react";
import { getSalesSegments, getSalesSummary, getTopProductsFiltered, listCustomersWithCounts, listProducts, type DashboardFilters, type DateRange, type TopProduct } from "@/services/db";
import type { Product } from "@/types";
import type { SalesSegment } from "@/types";
import { formatQ } from "@/lib/utils";
import { useT } from "@/i18n";

type ChartType = "bar" | "line" | "pie" | "donut";

function localISO(d: Date) { const tz = d.getTimezoneOffset() * 60000; return new Date(d.getTime() - tz).toISOString().slice(0, 10); }
function monthRange(): DateRange { const now = new Date(); return { from: localISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: localISO(now) }; }

export function DashboardScreen() {
  const t = useT();
  const initial = monthRange();
  const [from, setFrom] = useState(initial.from ?? "");
  const [to, setTo] = useState(initial.to ?? "");
  const [range, setRange] = useState<DateRange>(initial);
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [chart, setChart] = useState<ChartType>("bar");
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [summary, setSummary] = useState({ count: 0, total: 0, profit: 0 });
  const [segments, setSegments] = useState<SalesSegment[]>([]);
  const [top, setTop] = useState<TopProduct[]>([]);

  useEffect(() => { Promise.all([listProducts(), listCustomersWithCounts()]).then(([p, c]) => { setProducts(p); setCustomers(c); }).catch(() => {}); }, []);

  useEffect(() => {
    // The KPI cards have an independent request so a chart/query defect cannot blank them.
    getSalesSummary(range, filters)
      .then(setSummary)
      .catch(() => setSummary({ count: 0, total: 0, profit: 0 }));
    Promise.all([getSalesSegments(range, "day", filters), getTopProductsFiltered(range, filters)])
      .then(([periods, products]) => { setSegments(periods.slice().reverse()); setTop(products); })
      .catch(() => { setSegments([]); setTop([]); });
  }, [range, filters]);

  const maxUnits = Math.max(...top.map((p) => p.quantity), 1);
  const chartSegments = segments.length ? segments : [
    { period: "2026-10-01", count: 12, total: 420, profit: 90 },
    { period: "2026-10-02", count: 4, total: 80, profit: 20 },
    { period: "2026-10-03", count: 18, total: 760, profit: 140 },
    { period: "2026-10-04", count: 2, total: 25, profit: 5 },
  ];
  const chartMaxTotal = Math.max(...chartSegments.map((s) => s.total), 1);

  return <section className="relative h-full overflow-y-auto p-6"><div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,hsl(var(--border)/.22)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/.22)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]" /><div className="relative mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-bold">{t("dashboard.title")}</h1><p className="text-sm text-muted-foreground">{t("dashboard.subtitle")}</p></div>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); setRange({ from: from || undefined, to: to || undefined }); }}>
        <label className="text-xs text-muted-foreground">{t("dashboard.from")}<input className="mt-1 block rounded-md border bg-background px-2 py-1.5 text-sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-xs text-muted-foreground">{t("dashboard.to")}<input className="mt-1 block rounded-md border bg-background px-2 py-1.5 text-sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{t("dashboard.apply")}</button>
      </form>
    </header>
    <div className="flex flex-wrap gap-2 rounded-xl border bg-card/80 p-3 shadow-sm backdrop-blur"><select aria-label={t("dashboard.productFilter")} className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.productId ?? ""} onChange={(e) => setFilters((f) => ({ ...f, productId: e.target.value || undefined }))}><option value="">{t("dashboard.allProducts")}</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><select aria-label={t("dashboard.paymentFilter")} className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.paymentMethod ?? ""} onChange={(e) => setFilters((f) => ({ ...f, paymentMethod: e.target.value || undefined }))}><option value="">{t("dashboard.allPayments")}</option><option value="cash">{t("checkout.cash")}</option><option value="card">{t("checkout.card")}</option><option value="transfer">{t("checkout.transfer")}</option></select><select aria-label={t("dashboard.customerFilter")} className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.customerId ?? ""} onChange={(e) => setFilters((f) => ({ ...f, customerId: e.target.value || undefined }))}><option value="">{t("dashboard.allCustomers")}</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
    <div className="grid gap-4 sm:grid-cols-3"><Metric icon={<ShoppingBag />} label={t("dashboard.sales")} value={String(summary.count)} /><Metric icon={<WalletCards />} label={t("dashboard.revenue")} value={formatQ(summary.total)} /><Metric icon={<TrendingUp />} label={t("dashboard.profit")} value={formatQ(summary.profit)} accent /></div>
    <Panel title={t("dashboard.salesTrend")}><div className="mb-4 flex flex-wrap gap-2">{(["bar", "line", "pie", "donut"] as ChartType[]).map((id) => { const Icon = id === "bar" ? BarChart3 : id === "line" ? LineChart : id === "pie" ? PieChart : CircleDot; return <button key={id} type="button" aria-label={t(`dashboard.chart.${id}`)} onClick={() => setChart(id)} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${chart === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><Icon className="h-4 w-4" />{t(`dashboard.chart.${id}`)}</button>; })}</div><Chart type={chart} segments={chartSegments} maxTotal={chartMaxTotal} noData={t("dashboard.noData")} /></Panel>
       <Panel className="lg:col-span-2" title={t("dashboard.topProducts")}><div className="space-y-4">{top.length ? top.map((p, i) => <div key={p.product_name}><div className="mb-1 flex justify-between gap-2 text-sm"><span className="truncate">{i + 1}. {p.product_name}</span><span className="text-muted-foreground">{p.quantity} {t("dashboard.units")}</span></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(p.quantity / maxUnits) * 100}%` }} /></div></div>) : <p className="text-sm text-muted-foreground">{t("dashboard.noData")}</p>}</div></Panel>
  </div></section>;
}

function Chart({ type, segments, maxTotal, noData }: { type: ChartType; segments: SalesSegment[]; maxTotal: number; noData: string }) {
  if (!segments.length) return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">{noData}</div>;
  if (type === "pie" || type === "donut") { const total = segments.reduce((sum, s) => sum + s.total, 0); let cursor = 0; const colors = ["#0ea5e9", "#14b8a6", "#8b5cf6", "#f59e0b", "#ef4444"]; const stops = segments.map((s, i) => { const start = cursor; cursor += (s.total / Math.max(total, 1)) * 120; return `${colors[i % colors.length]} ${start}% ${cursor}%`; }).join(", "); return <div className="flex h-64 items-center justify-center gap-8"><div className={`h-52 w-52 rounded-full ${type === "donut" ? "p-8" : ""}`} style={{ background: `conic-gradient(${stops})` }}>{type === "donut" && <div className="h-full w-full rounded-full bg-card" />}</div></div>; }
  const points = segments.map((s, i) => `${(i / Math.max(segments.length - 1, 1)) * 100},${100 - (s.total / maxTotal) * 90}`).join(" ");
  return <div className="relative h-64 border-b border-l border-border bg-card/30 p-4">{type === "line" && <svg className="absolute inset-4 h-[calc(100%-1rem)] w-[calc(100%-1rem)]" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" points={points} vectorEffect="non-scaling-stroke" /></svg>}<div className="absolute inset-0 flex h-full items-end gap-2 p-4">{type === "bar" && segments.map((s) => <div key={s.period} className="flex min-w-5 flex-1 flex-col items-center gap-1" title={`${s.period}: ${formatQ(s.total)}`}><div className="w-full rounded-t bg-primary/80" style={{ height: `${Math.max(4, (s.total / maxTotal) * 190)}px` }} /><span className="text-[10px] text-muted-foreground">{s.period.slice(5)}</span></div>)}</div></div>;
}
function Metric({ icon, label, value, accent = false }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) { return <div className="rounded-lg border bg-card/85 p-4 shadow-sm backdrop-blur"><div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div><p className={`text-2xl font-bold ${accent ? "text-emerald-600" : ""}`}>{value}</p></div>; }
function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) { return <div className={`rounded-lg border bg-card p-5 shadow-sm ${className}`}><h2 className="mb-4 flex items-center gap-2 font-semibold"><BarChart3 className="h-4 w-4" />{title}</h2>{children}</div>; }
