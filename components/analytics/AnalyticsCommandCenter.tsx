import Link from "next/link";
import { AlertTriangle, ArrowDown, BarChart3, CalendarDays, Database, Megaphone, Users } from "lucide-react";
import { MetaReportingConfig } from "@/components/analytics/MetaReportingConfig";
import type { AnalyticsReport, AnalyticsTab, Metric } from "@/lib/analytics/report";

const TABS: Array<[AnalyticsTab, string]> = [
  ["overview", "Overview"], ["funnel", "Funnel"], ["advertising", "Advertising"],
  ["pages", "Pages & Segments"], ["appointments", "Appointments"], ["leads", "Leads"], ["diagnostics", "Diagnostics"],
];

function formatMetric(metric: Pick<Metric, "value" | "format">, currency = "USD") {
  if (metric.value === null) return "—";
  if (metric.format === "currency") return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(metric.value);
  if (metric.format === "percent") return `${metric.value.toFixed(1)}%`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(metric.value);
}

function delta(metric: Metric): { text: string; positive: boolean } | null {
  if (metric.value === null || metric.previous === null || metric.previous === 0) return null;
  const value = ((metric.value - metric.previous) / Math.abs(metric.previous)) * 100;
  return { text: `${value >= 0 ? "↑" : "↓"} ${Math.abs(value).toFixed(1)}%`, positive: value >= 0 };
}

function MetricCard({ metric, currency }: { metric: Metric; currency: string }) {
  const change = delta(metric);
  return <div className="rounded-card border border-border bg-card p-4">
    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-faint-foreground">{metric.label}</p>
    <p className="tabular mt-2 text-[26px] font-extrabold tracking-[-0.03em] text-foreground">{formatMetric(metric, currency)}</p>
    <div className="mt-1.5 flex min-h-5 items-center gap-2 text-[11.5px]">
      {metric.note ? <span className="text-muted-foreground">{metric.note}</span> : change ? <><span className={change.positive ? "font-bold text-emerald-700" : "font-bold text-rose-700"}>{change.text}</span><span className="text-faint-foreground">vs previous</span></> : <span className="text-faint-foreground">No comparison</span>}
    </div>
  </div>;
}

function filterHref(report: AnalyticsReport, tab: AnalyticsTab) {
  const params = new URLSearchParams();
  params.set("tab", tab); params.set("range", report.filters.preset); params.set("start", report.filters.start); params.set("end", report.filters.end); params.set("method", report.filters.method); params.set("compare", report.filters.compare ? "1" : "0");
  for (const key of ["brand", "source", "campaign", "adset", "ad", "funnel", "segment", "page", "advisor", "status"] as const) if (report.filters[key]) params.set(key, report.filters[key]);
  return `/advisor/analytics?${params}`;
}

function FilterBar({ report, tab }: { report: AnalyticsReport; tab: AnalyticsTab }) {
  const f = report.filters;
  const selectors: Array<[string, string, string[]]> = [
    ["brand", "Brand", report.filterOptions.brand], ["source", "Traffic source", report.filterOptions.source], ["campaign", "Campaign", report.filterOptions.campaign],
    ["adset", "Ad set", report.filterOptions.adset], ["ad", "Ad", report.filterOptions.ad], ["funnel", "Funnel", report.filterOptions.funnel],
    ["segment", "Segment", report.filterOptions.segment], ["page", "Landing page", report.filterOptions.page], ["advisor", "Advisor", report.filterOptions.advisor], ["status", "Lead status", report.filterOptions.status],
  ];
  return <form method="get" className="rounded-card border border-border bg-card p-4">
    <input type="hidden" name="tab" value={tab} />
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      <label className="text-[11px] font-bold uppercase tracking-wide text-faint-foreground">Date range
        <select name="range" defaultValue={f.preset} className="mt-1 block w-full rounded-control border border-border bg-background px-2.5 py-2 text-[12px] font-semibold text-foreground">
          <option value="today">Today</option><option value="yesterday">Yesterday</option><option value="last7">Last 7 days</option><option value="last14">Last 14 days</option><option value="last30">Last 30 days</option><option value="thisMonth">This month</option><option value="lastMonth">Last month</option><option value="custom">Custom</option>
        </select>
      </label>
      <label className="text-[11px] font-bold uppercase tracking-wide text-faint-foreground">Start
        <input type="date" name="start" defaultValue={f.start} className="mt-1 block w-full rounded-control border border-border bg-background px-2.5 py-2 text-[12px] text-foreground" />
      </label>
      <label className="text-[11px] font-bold uppercase tracking-wide text-faint-foreground">End
        <input type="date" name="end" defaultValue={f.end} className="mt-1 block w-full rounded-control border border-border bg-background px-2.5 py-2 text-[12px] text-foreground" />
      </label>
      <label className="text-[11px] font-bold uppercase tracking-wide text-faint-foreground">Method
        <select name="method" defaultValue={f.method} className="mt-1 block w-full rounded-control border border-border bg-background px-2.5 py-2 text-[12px] font-semibold text-foreground"><option value="cohort">Lead cohort</option><option value="event">Event date</option></select>
      </label>
      {selectors.map(([name, label, values]) => <label key={name} className="text-[11px] font-bold uppercase tracking-wide text-faint-foreground">{label}
        <select name={name} defaultValue={f[name as keyof typeof f] as string} className="mt-1 block w-full rounded-control border border-border bg-background px-2.5 py-2 text-[12px] text-foreground"><option value="">All</option>{values.map((value) => <option key={value} value={value}>{report.filterLabels[name]?.[value] || value}</option>)}</select>
      </label>)}
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <input type="hidden" name="compare" value="0" />
      <label className="flex items-center gap-2 text-[12px] font-semibold text-muted-foreground"><input type="checkbox" name="compare" value="1" defaultChecked={f.compare} /> Compare to previous period</label>
      <button className="ml-auto rounded-control bg-primary px-4 py-2 text-[12px] font-bold text-primary-foreground">Apply filters</button>
    </div>
  </form>;
}

function Trend({ report }: { report: AnalyticsReport }) {
  const width = 900, height = 220, pad = 28;
  const max = Math.max(1, ...report.trend.flatMap((p) => [p.leads, p.qualified, p.bookings]));
  const points = (key: "leads" | "qualified" | "bookings") => report.trend.map((point, i) => `${pad + (i / Math.max(1, report.trend.length - 1)) * (width - pad * 2)},${height - pad - (point[key] / max) * (height - pad * 2)}`).join(" ");
  return <section className="rounded-card border border-border bg-card p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-[15px] font-bold">Acquisition trend</h2><p className="text-[12px] text-muted-foreground">Daily lead cohorts and their eventual downstream outcomes</p></div><div className="flex gap-4 text-[11px] font-semibold"><span className="text-[#16705a]">● Leads</span><span className="text-[#c99716]">● Qualified</span><span className="text-[#0e7490]">● Booked</span></div></div>
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-[220px] w-full" role="img" aria-label="Leads, qualified leads, and bookings over time">
      {[0, .25, .5, .75, 1].map((portion) => <line key={portion} x1={pad} x2={width-pad} y1={pad+portion*(height-pad*2)} y2={pad+portion*(height-pad*2)} stroke="#e5e7eb" strokeWidth="1" />)}
      <polyline points={points("leads")} fill="none" stroke="#16705a" strokeWidth="3" strokeLinejoin="round" />
      <polyline points={points("qualified")} fill="none" stroke="#c99716" strokeWidth="2.5" strokeLinejoin="round" />
      <polyline points={points("bookings")} fill="none" stroke="#0e7490" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  </section>;
}

function Funnel({ report }: { report: AnalyticsReport }) {
  const max = Math.max(1, ...report.funnel.map((stage) => stage.count ?? 0));
  return <section className="rounded-card border border-border bg-card p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="text-[16px] font-bold">Full acquisition funnel</h2><p className="mt-1 text-[12px] text-muted-foreground">Unique prospects · {report.filters.method === "cohort" ? "lead cohort view" : "event date view"}</p></div><p className="text-right text-[11px] text-faint-foreground">Cost uses locally cached Meta spend<br />Blank means not connected</p></div>
    <div className="mt-5 space-y-2">{report.funnel.map((stage, index) => <div key={stage.key}>
      {index > 0 && <div className="flex h-6 items-center pl-[18%]"><ArrowDown className="size-3.5 text-faint-foreground" /><span className="ml-2 text-[10px] font-bold text-faint-foreground">{stage.fromPrevious === null ? "—" : `${stage.fromPrevious.toFixed(1)}% from previous`}</span></div>}
      <div className="grid items-center gap-3 md:grid-cols-[190px_1fr_270px]"><div><p className="text-[12.5px] font-bold text-foreground">{stage.label}</p><p className="tabular text-[21px] font-extrabold">{stage.count === null ? "—" : stage.count.toLocaleString()}</p></div><div className="h-9 overflow-hidden rounded-[8px] bg-surface"><div className="h-full rounded-[8px] bg-[linear-gradient(90deg,#1b7a61,#4f9b82)]" style={{ width: `${stage.count === null ? 0 : Math.max(2, stage.count / max * 100)}%` }} /></div><div className="grid grid-cols-3 gap-2 text-[10.5px] text-muted-foreground"><span><b className="block text-foreground">{stage.fromInitial === null ? "—" : `${stage.fromInitial.toFixed(1)}%`}</b>from initial</span><span><b className="block text-foreground">{stage.dropOff === null ? "—" : stage.dropOff.toLocaleString()}</b>drop-off</span><span><b className="block text-foreground">{stage.cost === null ? "—" : formatMetric({ value: stage.cost, format: "currency" }, report.currency)}</b>cost / stage</span></div></div>
    </div>)}</div></section>;
}

function DataTable({ report, mode }: { report: AnalyticsReport; mode: "ads" | "pages" | "leads" | "appointments" }) {
  if (mode === "ads") return <div className="overflow-x-auto rounded-card border border-border bg-card"><table className="min-w-[1250px] w-full text-left text-[12px]"><thead className="bg-surface text-[10px] uppercase tracking-wide text-faint-foreground"><tr>{["Campaign","Ad set","Ad","Spend","Impressions","Clicks","CTR","Leads","CPL","Portal","Video complete","Assessments","Qualified","Cost / qualified","Bookings","Cost / booking","Shows","Closed"].map(h=><th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{report.ads.map(row=><tr key={row.key} className="border-t border-border"><td className="px-3 py-3 font-bold">{row.campaign}</td><td className="px-3">{row.adset}</td><td className="px-3">{row.ad}</td><td className="px-3">{formatMetric({value:row.spend,format:"currency"},report.currency)}</td><td className="px-3">{row.impressions.toLocaleString()}</td><td className="px-3">{row.clicks}</td><td className="px-3">{row.impressions ? `${(row.clicks/row.impressions*100).toFixed(1)}%` : "—"}</td><td className="px-3">{row.leads}</td><td className="px-3">{row.leads&&row.spend?formatMetric({value:row.spend/row.leads,format:"currency"},report.currency):"—"}</td><td className="px-3">{row.portal}</td><td className="px-3">{row.completed}</td><td className="px-3">{row.assessments}</td><td className="px-3">{row.qualified}</td><td className="px-3">{row.qualified&&row.spend?formatMetric({value:row.spend/row.qualified,format:"currency"},report.currency):"—"}</td><td className="px-3">{row.bookings}</td><td className="px-3">{row.bookings&&row.spend?formatMetric({value:row.spend/row.bookings,format:"currency"},report.currency):"—"}</td><td className="px-3">{row.shows}</td><td className="px-3">{row.closed}</td></tr>)}</tbody></table></div>;
  if (mode === "pages") return <div className="overflow-x-auto rounded-card border border-border bg-card"><table className="min-w-[900px] w-full text-left text-[12px]"><thead className="bg-surface text-[10px] uppercase tracking-wide text-faint-foreground"><tr>{["Landing / page","Leads","Portal opens","Video starts","Video completes","Assessments","Qualified","Bookings","Lead → booking"].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody>{report.pages.map(row=><tr key={row.page} className="border-t border-border"><td className="max-w-[320px] truncate px-4 py-3 font-bold">{row.page}</td><td className="px-4">{row.leads}</td><td className="px-4">{row.portal}</td><td className="px-4">{row.videoStarts}</td><td className="px-4">{row.videoCompletes}</td><td className="px-4">{row.assessments}</td><td className="px-4">{row.qualified}</td><td className="px-4">{row.bookings}</td><td className="px-4">{row.leads?`${(row.bookings/row.leads*100).toFixed(1)}%`:"—"}</td></tr>)}</tbody></table></div>;
  const rows = mode === "appointments" ? report.leads.filter(row=>row.appointment!=="—") : report.leads;
  return <div className="overflow-x-auto rounded-card border border-border bg-card"><table className="min-w-[1200px] w-full text-left text-[12px]"><thead className="bg-surface text-[10px] uppercase tracking-wide text-faint-foreground"><tr>{["Lead","Brand","Source","Campaign","Ad","Landing page","Portal","Video","Assessment","Qualification","Advisor","Appointment","Created"].map(h=><th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-t border-border"><td className="px-3 py-3"><Link className="font-bold text-primary hover:underline" href={`/advisor/investors/${row.id}`}>{row.name}</Link></td><td className="px-3">{row.brand}</td><td className="px-3">{row.source}</td><td className="px-3">{row.campaign}</td><td className="px-3">{row.ad}</td><td className="max-w-[220px] truncate px-3">{row.page}</td><td className="px-3">{row.portal?"Opened":"—"}</td><td className="px-3">{row.video}%</td><td className="px-3">{row.assessment?"Complete":"—"}</td><td className="px-3">{row.qualification}</td><td className="px-3">{row.advisor}</td><td className="px-3">{row.appointment}</td><td className="px-3">{new Date(row.created).toLocaleDateString()}</td></tr>)}</tbody></table></div>;
}

export function AnalyticsCommandCenter({ report, tab }: { report: AnalyticsReport; tab: AnalyticsTab }) {
  return <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center gap-1 border-b border-border">{TABS.map(([key,label])=><Link key={key} href={filterHref(report,key)} className={`border-b-2 px-3.5 py-2.5 text-[12.5px] font-bold ${tab===key?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground"}`}>{label}</Link>)}</div>
    <FilterBar report={report} tab={tab} />
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-surface px-4 py-2 text-[11.5px] text-muted-foreground"><span><b className="text-foreground">{report.filters.method === "cohort" ? "Lead cohort view" : "Event date view"}</b> · {report.filters.start} through {report.filters.end}</span><span>Meta freshness: {report.freshness ? new Date(report.freshness).toLocaleString() : "Not connected"}</span></div>
    {tab === "overview" && <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{report.metrics.map(metric=><MetricCard key={metric.key} metric={metric} currency={report.currency} />)}</div><Trend report={report} /><Funnel report={report} />{report.funnelWatch&&<section className="rounded-card border border-amber-200 bg-amber-50 p-5"><div className="flex gap-3"><AlertTriangle className="mt-0.5 size-5 text-amber-700"/><div><p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Funnel Watch · largest conversion leak</p><h2 className="mt-1 text-[16px] font-bold text-foreground">{report.funnelWatch.title}</h2><p className="mt-1 text-[13px] text-muted-foreground">Current {report.funnelWatch.current.toFixed(1)}%{report.funnelWatch.previous===null?"":` · Previous ${report.funnelWatch.previous.toFixed(1)}% · ${report.funnelWatch.change!>=0?"up":"down"} ${Math.abs(report.funnelWatch.change!).toFixed(1)} percentage points`}. This identifies movement, not causation.</p></div></div></section>}</>}
    {tab === "funnel" && <><Funnel report={report} /><section><h2 className="mb-3 text-[15px] font-bold">Key conversions</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{report.conversions.map(metric=><MetricCard key={metric.key} metric={metric} currency={report.currency}/>)}</div></section><section><h2 className="mb-3 text-[15px] font-bold">Cost efficiency</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{report.efficiency.map(metric=><MetricCard key={metric.key} metric={metric} currency={report.currency}/>)}</div></section></>}
    {tab === "advertising" && <><div className="grid gap-3 sm:grid-cols-3"><MetricCard metric={report.metrics[0]} currency={report.currency}/><MetricCard metric={report.metrics[2]} currency={report.currency}/><MetricCard metric={report.metrics[6]} currency={report.currency}/></div><DataTable report={report} mode="ads" /></>}
    {tab === "pages" && <DataTable report={report} mode="pages" />}
    {tab === "appointments" && <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[report.metrics[7],report.metrics[8],report.conversions.find(m=>m.key==="shows-bookings")!,report.conversions.find(m=>m.key==="closed-shows")!].filter(Boolean).map(metric=><MetricCard key={metric.key} metric={metric} currency={report.currency}/>)}</div><DataTable report={report} mode="appointments" /></>}
    {tab === "leads" && <DataTable report={report} mode="leads" />}
    {tab === "diagnostics" && <><MetaReportingConfig/><section className="grid gap-3 md:grid-cols-2">{report.diagnostics.map((message,index)=><div key={message} className="rounded-card border border-border bg-card p-4"><div className="flex gap-3">{index===0?<Megaphone className="size-4 text-primary"/>:index===1?<Database className="size-4 text-primary"/>:index===2?<BarChart3 className="size-4 text-primary"/>:<Users className="size-4 text-primary"/>}<p className="text-[13px] leading-5 text-foreground">{message}</p></div></div>)}</section><section className="rounded-card border border-border bg-card p-5"><div className="flex gap-3"><CalendarDays className="size-5 text-primary"/><div><h2 className="font-bold">Data methodology</h2><p className="mt-1 text-[13px] leading-5 text-muted-foreground">Lead cohort view asks what ultimately happened to people acquired in the selected range. Event date view asks what occurred during the range. Funnel counts default to unique people, not repeated events. Meta supplies delivery and spend; Compass supplies downstream outcomes.</p></div></div></section></>}
  </div>;
}
