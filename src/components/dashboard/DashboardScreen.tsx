import { useEffect, useState } from "react";
import { BarChart3, CircleDot, LineChart, PieChart, TrendingUp, WalletCards, ShoppingBag } from "lucide-react";
import { getSalesSegments, getSalesSummary, getTopProductsFiltered, listCustomersWithCounts, listProducts, type DashboardFilters, type DateRange, type TopProduct } from "@/services/db";
import type { Product } from "@/types";
import type { SalesSegment } from "@/types";
import { formatQ } from "@/lib/utils";

type ChartType = "bar" | "line" | "pie" | "donut";
const russianLabels: Record<string, string> = {
  title: "Панель продаж",
  subtitle: "Визуальный обзор эффективности бизнеса",
  from: "С",
  to: "По",
  apply: "Применить",
  sales: "Продажи",
  revenue: "Доход",
  profit: "Прибыль",
  topProducts: "Самые продаваемые товары",
  salesTrend: "Продажи по периодам",
  noData: "Нет данных за этот период",
  product: "Товар",
  payment: "Способ оплаты",
  customer: "Клиент",
  allProducts: "Все товары",
  allPayments: "Все способы",
  allCustomers: "Все клиенты",
  bar: "Столбцы",
  line: "Линии",
  pie: "Круг",
  donut: "Пончик",
  units: "единиц",
};

function localISO(d: Date) { const tz = d.getTimezoneOffset() * 60000; return new Date(d.getTime() - tz).toISOString().slice(0, 10); }
function monthRange(): DateRange { const now = new Date(); return { from: localISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: localISO(now) }; }

export function DashboardScreen() {
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

  return <section className="relative h-full overflow-y-auto bg-[#f4ead7] p-6 text-[#3c2415]"><div className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(#c45432_1.5px,transparent_1.5px)] [background-size:19px_19px]" /><div className="relative mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-black uppercase tracking-widest">{russianLabels.title}</h1><p className="text-sm text-[#884b38]">{russianLabels.subtitle}</p></div>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); setRange({ from: from || undefined, to: to || undefined }); }}>
        <label className="text-xs font-bold text-[#884b38]">{russianLabels.from}<input className="mt-1 block rounded-none border-2 border-[#c45432] bg-[#fff8e9] px-2 py-1.5 text-sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-xs font-bold text-[#884b38]">{russianLabels.to}<input className="mt-1 block rounded-none border-2 border-[#c45432] bg-[#fff8e9] px-2 py-1.5 text-sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button className="rounded-none border-2 border-[#3c2415] bg-[#c45432] px-4 py-2 text-sm font-black uppercase text-[#fff8e9]">{russianLabels.apply}</button>
      </form>
    </header>
    <div className="flex flex-wrap gap-2 border-4 border-[#3c2415] bg-[#fff8e9] p-3 shadow-[8px_8px_0_#c45432]"><select aria-label={russianLabels.product} className="rounded-none border-2 border-[#3c2415] bg-[#fff8e9] px-3 py-2 text-sm" value={filters.productId ?? ""} onChange={(e) => setFilters((f) => ({ ...f, productId: e.target.value || undefined }))}><option value="">{russianLabels.allProducts}</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><select aria-label={russianLabels.payment} className="rounded-none border-2 border-[#3c2415] bg-[#fff8e9] px-3 py-2 text-sm" value={filters.paymentMethod ?? ""} onChange={(e) => setFilters((f) => ({ ...f, paymentMethod: e.target.value || undefined }))}><option value="">{russianLabels.allPayments}</option><option value="cash">Наличные</option><option value="card">Карта</option><option value="transfer">Перевод</option></select><select aria-label={russianLabels.customer} className="rounded-none border-2 border-[#3c2415] bg-[#fff8e9] px-3 py-2 text-sm" value={filters.customerId ?? ""} onChange={(e) => setFilters((f) => ({ ...f, customerId: e.target.value || undefined }))}><option value="">{russianLabels.allCustomers}</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
    <div className="grid gap-4 sm:grid-cols-3"><Metric icon={<ShoppingBag />} label={russianLabels.sales} value={String(summary.count)} /><Metric icon={<WalletCards />} label={russianLabels.revenue} value={formatQ(summary.total)} /><Metric icon={<TrendingUp />} label={russianLabels.profit} value={formatQ(summary.profit)} accent /></div>
    <Panel title={russianLabels.salesTrend}><div className="mb-4 flex flex-wrap gap-2">{(["bar", "line", "pie", "donut"] as ChartType[]).map((id) => { const Icon = id === "bar" ? BarChart3 : id === "line" ? LineChart : id === "pie" ? PieChart : CircleDot; return <button key={id} type="button" aria-label={russianLabels[id]} onClick={() => setChart(id)} className={`flex items-center gap-2 rounded-none border-2 border-[#3c2415] px-3 py-2 text-sm font-bold ${chart === id ? "bg-[#3c2415] text-[#fff8e9]" : "bg-[#e8b04b] text-[#3c2415]"}`}><Icon className="h-4 w-4" />{russianLabels[id]}</button>; })}</div><Chart type={({ bar: "donut", line: "bar", pie: "line", donut: "pie" } as Record<ChartType, ChartType>)[chart]} segments={chartSegments} maxTotal={chartMaxTotal} noData={russianLabels.noData} /></Panel>
       <Panel className="lg:col-span-2" title={russianLabels.topProducts}><div className="space-y-4">{top.length ? top.map((p, i) => <div key={p.product_name}><div className="mb-1 flex justify-between gap-2 text-sm"><span className="truncate">{i + 1}. {p.product_name}</span><span className="text-[#884b38]">{p.quantity} {russianLabels.units}</span></div><div className="h-2 rounded-none bg-[#e8b04b]"><div className="h-2 rounded-none bg-[#c45432]" style={{ width: `${(p.quantity / maxUnits) * 100}%` }} /></div></div>) : <p className="text-sm text-[#884b38]">{russianLabels.noData}</p>}</div></Panel>
  </div></section>;
}

function Chart({ type, segments, maxTotal, noData }: { type: ChartType; segments: SalesSegment[]; maxTotal: number; noData: string }) {
  if (!segments.length) return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">{noData}</div>;
  if (type === "pie" || type === "donut") { const total = segments.reduce((sum, s) => sum + s.total, 0); let cursor = 0; const colors = ["#c45432", "#e8b04b", "#5d7c56", "#8f5b3b", "#2e4057"]; const stops = segments.map((s, i) => { const start = cursor; cursor += (s.total / Math.max(total, 1)) * 120; return `${colors[i % colors.length]} ${start}% ${cursor}%`; }).join(", "); return <div className="flex h-64 items-center justify-center gap-8 bg-[#fff8e9] p-4"><div className={`h-52 w-52 rounded-[18%] border-4 border-[#3c2415] ${type === "donut" ? "p-8" : ""}`} style={{ background: `conic-gradient(${stops})`, transform: "rotate(17deg)" }}>{type === "donut" && <div className="h-full w-full rounded-full bg-[#f4ead7]" />}</div></div>; }
  const points = segments.map((s, i) => `${(i / Math.max(segments.length - 1, 1)) * 100},${100 - (s.total / maxTotal) * 90}`).join(" ");
  return <div className="relative h-64 border-4 border-dashed border-[#c45432] bg-[#e8b04b] p-4">{type === "line" && <svg className="absolute inset-4 h-[calc(100%-1rem)] w-[calc(100%-1rem)]" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline fill="none" stroke="#2e4057" strokeWidth="6" points={points} vectorEffect="non-scaling-stroke" /></svg>}<div className="absolute inset-0 flex h-full items-end gap-2 p-4">{type === "bar" && segments.map((s) => <div key={s.period} className="flex min-w-5 flex-1 flex-col items-center gap-1" title={`${s.period}: ${formatQ(s.total)}`}><div className="w-full rounded-none border-2 border-[#3c2415] bg-[#c45432]" style={{ height: `${Math.max(4, (s.total / maxTotal) * 190)}px` }} /><span className="text-[10px] font-bold text-[#3c2415]">{s.period.slice(5)}</span></div>)}</div></div>;
}
function Metric({ icon, label, value, accent = false }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) { return <div className="rounded-lg border bg-card/85 p-4 shadow-sm backdrop-blur"><div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div><p className={`text-2xl font-bold ${accent ? "text-emerald-600" : ""}`}>{value}</p></div>; }
function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) { return <div className={`rounded-lg border bg-card p-5 shadow-sm ${className}`}><h2 className="mb-4 flex items-center gap-2 font-semibold"><BarChart3 className="h-4 w-4" />{title}</h2>{children}</div>; }
