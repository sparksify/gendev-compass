import { getStore } from "@/lib/store";
import { loadInvestorRows, type InvestorRow } from "@/lib/advisor/investors";
import { resolveMetaReportingAccessToken, resolveMetaReportingAdAccountId } from "@/lib/tracking/settings";
import type { StaffUserRecord } from "@/types/advisor";
import type { MetaAdDailyStatRecord } from "@/types/analyticsReporting";

export type AnalyticsMethod = "cohort" | "event";
export type AnalyticsTab = "overview" | "funnel" | "advertising" | "pages" | "appointments" | "leads" | "diagnostics";

export interface AnalyticsFilters {
  start: string;
  end: string;
  preset: string;
  method: AnalyticsMethod;
  compare: boolean;
  brand: string;
  source: string;
  campaign: string;
  adset: string;
  ad: string;
  funnel: string;
  segment: string;
  page: string;
  advisor: string;
  status: string;
}

export interface Metric {
  key: string;
  label: string;
  value: number | null;
  previous: number | null;
  format: "number" | "currency" | "percent";
  note?: string;
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number | null;
  previous: number | null;
  fromPrevious: number | null;
  fromInitial: number | null;
  dropOff: number | null;
  cost: number | null;
}

export interface AnalyticsLeadRow {
  id: string;
  name: string;
  brand: string;
  source: string;
  campaign: string;
  ad: string;
  page: string;
  portal: boolean;
  video: number;
  assessment: boolean;
  qualification: string;
  advisor: string;
  appointment: string;
  created: string;
}

export interface AdPerformanceRow {
  key: string;
  campaign: string;
  adset: string;
  ad: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  portal: number;
  completed: number;
  assessments: number;
  qualified: number;
  bookings: number;
  shows: number;
  closed: number;
}

export interface PagePerformanceRow {
  page: string;
  leads: number;
  portal: number;
  videoStarts: number;
  videoCompletes: number;
  assessments: number;
  qualified: number;
  bookings: number;
}

export interface TrendPoint { date: string; leads: number; qualified: number; bookings: number; spend: number }

export interface AnalyticsReport {
  filters: AnalyticsFilters;
  previousRange: { start: string; end: string };
  metaConnected: boolean;
  freshness: string | null;
  currency: string;
  metrics: Metric[];
  funnel: FunnelStage[];
  conversions: Metric[];
  efficiency: Metric[];
  trend: TrendPoint[];
  ads: AdPerformanceRow[];
  pages: PagePerformanceRow[];
  leads: AnalyticsLeadRow[];
  filterOptions: Record<string, string[]>;
  filterLabels: Record<string, Record<string, string>>;
  funnelWatch: { title: string; current: number; previous: number | null; change: number | null } | null;
  diagnostics: string[];
}

const DAY = 86_400_000;

function isoDay(date: Date): string { return date.toISOString().slice(0, 10); }
function startOfDay(day: string): Date { return new Date(`${day}T00:00:00.000Z`); }
function endExclusive(day: string): Date { return new Date(startOfDay(day).getTime() + DAY); }

export function defaultAnalyticsFilters(now = new Date()): AnalyticsFilters {
  const end = isoDay(now);
  const startDate = new Date(startOfDay(end).getTime() - 6 * DAY);
  return {
    start: isoDay(startDate), end, preset: "last7", method: "cohort", compare: true,
    brand: "", source: "", campaign: "", adset: "", ad: "", funnel: "", segment: "",
    page: "", advisor: "", status: "",
  };
}

export function parseAnalyticsFilters(params: Record<string, string | string[] | undefined>, now = new Date()): AnalyticsFilters {
  const defaults = defaultAnalyticsFilters(now);
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[value.length - 1] ?? "" : typeof value === "string" ? value : "";
  };
  const preset = single("range") || defaults.preset;
  let start = single("start");
  let end = single("end");
  const today = startOfDay(isoDay(now));
  const presetDays: Record<string, number> = { today: 1, yesterday: 1, last7: 7, last14: 14, last30: 30 };
  if (preset === "yesterday") {
    const yesterday = new Date(today.getTime() - DAY);
    start = end = isoDay(yesterday);
  } else if (presetDays[preset]) {
    end = isoDay(today);
    start = isoDay(new Date(today.getTime() - (presetDays[preset] - 1) * DAY));
  } else if (preset === "thisMonth") {
    start = isoDay(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
    end = isoDay(today);
  } else if (preset === "lastMonth") {
    const firstThisMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const firstLastMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    start = isoDay(firstLastMonth);
    end = isoDay(new Date(firstThisMonth.getTime() - DAY));
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) start = defaults.start;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) end = defaults.end;
  if (start > end) [start, end] = [end, start];
  return {
    ...defaults, start, end, preset,
    method: single("method") === "event" ? "event" : "cohort",
    compare: single("compare") !== "0",
    brand: single("brand"), source: single("source"), campaign: single("campaign"),
    adset: single("adset"), ad: single("ad"), funnel: single("funnel"), segment: single("segment"),
    page: single("page"), advisor: single("advisor"), status: single("status"),
  };
}

function inRange(value: string | null | undefined, start: Date, end: Date): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= start.getTime() && time < end.getTime();
}

function eventual(row: InvestorRow, stage: string): boolean {
  const lead = row.lead;
  switch (stage) {
    case "leads": return true;
    case "portal": return Boolean(lead.portal_first_opened_at);
    case "videoStart": return Boolean(lead.video_started_at || row.video?.started);
    case "video25": return (row.video?.highest_percent_watched ?? 0) >= 25;
    case "video50": return (row.video?.highest_percent_watched ?? 0) >= 50;
    case "video75": return (row.video?.highest_percent_watched ?? 0) >= 75;
    case "videoComplete": return Boolean(lead.video_completed_at || row.video?.completed);
    case "assessmentStart": return Boolean(lead.questionnaire_started_at || row.assessment);
    case "assessment": return Boolean(lead.questionnaire_completed_at || row.assessment);
    case "qualified": return lead.qualification_result === "qualified";
    case "review": return lead.qualification_result === "review_required";
    case "calendar": return Boolean(lead.calendar_viewed_at);
    case "bookings": return Boolean(lead.booked_at || row.appointments.length);
    case "shows": return row.appointments.some((appointment) => appointment.status === "COMPLETED");
    case "noShows": return row.appointments.some((appointment) => appointment.status === "NO_SHOW");
    case "closed": return row.stage === "CLOSED_INVESTED";
    default: return false;
  }
}

function occurred(row: InvestorRow, stage: string, start: Date, end: Date): boolean {
  const lead = row.lead;
  switch (stage) {
    case "leads": return inRange(lead.created_at, start, end);
    case "portal": return inRange(lead.portal_first_opened_at, start, end);
    case "videoStart": return inRange(lead.video_started_at ?? row.video?.first_played_at, start, end);
    case "videoComplete": return inRange(lead.video_completed_at, start, end);
    case "assessmentStart": return inRange(lead.questionnaire_started_at, start, end);
    case "assessment": return inRange(lead.questionnaire_completed_at, start, end);
    case "qualified": return lead.qualification_result === "qualified" && inRange(lead.qualified_at, start, end);
    case "review": return lead.qualification_result === "review_required" && inRange(lead.updated_at, start, end);
    case "calendar": return inRange(lead.calendar_viewed_at, start, end);
    case "bookings": return inRange(lead.booked_at, start, end) || row.appointments.some((a) => inRange(a.created_at, start, end));
    case "shows": return row.appointments.some((a) => a.status === "COMPLETED" && inRange(a.updated_at, start, end));
    case "noShows": return row.appointments.some((a) => a.status === "NO_SHOW" && inRange(a.updated_at, start, end));
    case "closed": return row.stage === "CLOSED_INVESTED" && inRange(lead.updated_at, start, end);
    default: return eventual(row, stage) && inRange(lead.created_at, start, end);
  }
}

function pageFor(row: InvestorRow): string { return row.lead.first_landing_page || "Unknown / direct"; }
function funnelFor(row: InvestorRow): string { return row.lead.first_utm_campaign || row.lead.campaign || "Unassigned"; }
function segmentFor(row: InvestorRow): string { return row.lead.first_utm_content || "Unassigned"; }

function filtered(rows: InvestorRow[], filters: AnalyticsFilters): InvestorRow[] {
  return rows.filter((row) => {
    const lead = row.lead;
    if (filters.brand && (row.brand?.name ?? "Unassigned brand") !== filters.brand) return false;
    if (filters.source && (lead.first_utm_source || lead.source || "") !== filters.source) return false;
    if (filters.campaign && (lead.facebook_campaign_id || funnelFor(row)) !== filters.campaign) return false;
    if (filters.adset && (lead.facebook_adset_id || lead.ad_set || "") !== filters.adset) return false;
    if (filters.ad && (lead.facebook_ad_id || lead.ad || "") !== filters.ad) return false;
    if (filters.funnel && funnelFor(row) !== filters.funnel) return false;
    if (filters.segment && segmentFor(row) !== filters.segment) return false;
    if (filters.page && pageFor(row) !== filters.page) return false;
    if (filters.advisor && lead.assigned_advisor_id !== filters.advisor) return false;
    if (filters.status && lead.status !== filters.status) return false;
    return true;
  });
}

function sum(stats: MetaAdDailyStatRecord[], key: "spend" | "impressions" | "clicks" | "link_clicks" | "meta_leads"): number {
  return stats.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function rate(num: number | null, den: number | null): number | null {
  return num !== null && den ? (num / den) * 100 : null;
}
function cost(spend: number | null, count: number | null): number | null {
  return spend !== null && count ? spend / count : null;
}

function previousRange(start: Date, end: Date) {
  const duration = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - duration), end: start };
}

function option(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

export async function loadAnalyticsReport(user: StaffUserRecord, filters: AnalyticsFilters): Promise<AnalyticsReport> {
  const store = getStore();
  const currentStart = startOfDay(filters.start);
  const currentEnd = endExclusive(filters.end);
  const previous = previousRange(currentStart, currentEnd);
  const [allRows, metaResult, settings, bridgeCurrent, bridgePrevious] = await Promise.all([
    loadInvestorRows(user),
    store.listMetaAdDailyStats({ startDate: isoDay(previous.start), endDate: filters.end })
      .then((stats) => ({ stats, error: null as string | null }))
      .catch((error: unknown) => ({ stats: [] as MetaAdDailyStatRecord[], error: error instanceof Error ? error.message : "Meta reporting storage is unavailable." })),
    store.getTrackingSettings(),
    store.countBridgeVisitsBetween(currentStart.toISOString(), currentEnd.toISOString()),
    store.countBridgeVisitsBetween(previous.start.toISOString(), previous.end.toISOString()),
  ]);
  const metaStats = metaResult.stats;
  const selectedBrandIds = new Set(
    allRows.filter((row) => row.brand?.name === filters.brand).map((row) => row.brand?.id).filter((id): id is string => Boolean(id)),
  );
  const scoped = filtered(allRows, filters);
  const currentRows = filters.method === "cohort"
    ? scoped.filter((row) => inRange(row.lead.created_at, currentStart, currentEnd))
    : scoped;
  const previousRows = filters.method === "cohort"
    ? scoped.filter((row) => inRange(row.lead.created_at, previous.start, previous.end))
    : scoped;
  const countStage = (rows: InvestorRow[], stage: string, start: Date, end: Date) =>
    rows.filter((row) => filters.method === "cohort" ? eventual(row, stage) : occurred(row, stage, start, end)).length;
  const curr = (stage: string) => countStage(currentRows, stage, currentStart, currentEnd);
  const prev = (stage: string) => countStage(previousRows, stage, previous.start, previous.end);

  const filteredMeta = metaStats.filter((row) => {
    if (filters.brand && (!row.brand_id || !selectedBrandIds.has(row.brand_id))) return false;
    if (filters.campaign && row.campaign_id !== filters.campaign && row.campaign_name !== filters.campaign) return false;
    if (filters.adset && row.adset_id !== filters.adset && row.adset_name !== filters.adset) return false;
    if (filters.ad && row.ad_id !== filters.ad && row.ad_name !== filters.ad) return false;
    return true;
  });
  const currentMeta = filteredMeta.filter((row) => row.date >= filters.start && row.date <= filters.end);
  const previousMeta = filteredMeta.filter((row) => row.date >= isoDay(previous.start) && row.date < filters.start);
  const metaConnected = Boolean(!metaResult.error && settings.meta_reporting_enabled && resolveMetaReportingAdAccountId(settings) && resolveMetaReportingAccessToken(settings));
  const downstreamOnlyFilter = Boolean(filters.source || filters.funnel || filters.segment || filters.page || filters.advisor || filters.status);
  const bridgeComparable = !Boolean(filters.brand || filters.source || filters.campaign || filters.adset || filters.ad || filters.funnel || filters.segment || filters.page || filters.advisor || filters.status);
  const spendComparable = metaConnected && !downstreamOnlyFilter;
  const currentSpend = spendComparable ? sum(currentMeta, "spend") : null;
  const previousSpend = spendComparable ? sum(previousMeta, "spend") : null;
  const leads = curr("leads");
  const previousLeads = prev("leads");
  const stageDefs: Array<[string, string, number | null, number | null]> = [
    ["impressions", "Meta impressions", spendComparable ? sum(currentMeta, "impressions") : null, spendComparable ? sum(previousMeta, "impressions") : null],
    ["clicks", "Meta link clicks", spendComparable ? sum(currentMeta, "link_clicks") : null, spendComparable ? sum(previousMeta, "link_clicks") : null],
    ["bridge", "Landing / bridge visits", bridgeComparable ? bridgeCurrent : null, bridgeComparable ? bridgePrevious : null],
    ["leads", "Leads submitted", leads, previousLeads],
    ["portal", "Portal opened", curr("portal"), prev("portal")],
    ["videoStart", "Overview video started", curr("videoStart"), prev("videoStart")],
    ["videoComplete", "Overview video completed", curr("videoComplete"), prev("videoComplete")],
    ["assessment", "Assessment completed", curr("assessment"), prev("assessment")],
    ["qualified", "Qualified", curr("qualified"), prev("qualified")],
    ["calendar", "Calendar viewed", curr("calendar"), prev("calendar")],
    ["bookings", "Appointment booked", curr("bookings"), prev("bookings")],
    ["shows", "Consultation showed", curr("shows"), prev("shows")],
    ["closed", "Closed / won", curr("closed"), prev("closed")],
  ];
  const firstKnown = stageDefs.find((stage) => stage[2] !== null && (stage[2] ?? 0) > 0)?.[2] ?? leads;
  const funnel: FunnelStage[] = stageDefs.map((stage, index) => {
    const prior = index > 0 ? stageDefs[index - 1][2] : null;
    return {
      key: stage[0], label: stage[1], count: stage[2], previous: stage[3],
      fromPrevious: rate(stage[2], prior), fromInitial: rate(stage[2], firstKnown),
      dropOff: stage[2] !== null && prior !== null ? Math.max(0, prior - stage[2]) : null,
      cost: cost(currentSpend, stage[2]),
    };
  });

  const metrics: Metric[] = [
    { key: "spend", label: "Ad spend", value: currentSpend, previous: previousSpend, format: "currency", note: !metaConnected ? "Not connected" : downstreamOnlyFilter ? "Unavailable for downstream-only filters" : undefined },
    { key: "leads", label: "Leads", value: leads, previous: previousLeads, format: "number" },
    { key: "cpl", label: "Cost per lead", value: cost(currentSpend, leads), previous: cost(previousSpend, previousLeads), format: "currency" },
    { key: "portal", label: "Portal visitors", value: curr("portal"), previous: prev("portal"), format: "number" },
    { key: "assessments", label: "Assessments completed", value: curr("assessment"), previous: prev("assessment"), format: "number" },
    { key: "qualified", label: "Qualified leads", value: curr("qualified"), previous: prev("qualified"), format: "number" },
    { key: "cpql", label: "Cost / qualified", value: cost(currentSpend, curr("qualified")), previous: cost(previousSpend, prev("qualified")), format: "currency" },
    { key: "bookings", label: "Appointments booked", value: curr("bookings"), previous: prev("bookings"), format: "number" },
    { key: "cpb", label: "Cost / appointment", value: cost(currentSpend, curr("bookings")), previous: cost(previousSpend, prev("bookings")), format: "currency" },
  ];
  const transitions: Array<[string, string, string]> = [
    ["Lead → portal", "portal", "leads"], ["Portal → video start", "videoStart", "portal"],
    ["Video start → complete", "videoComplete", "videoStart"],
    ["Video complete → assessment", "assessment", "videoComplete"], ["Assessment → qualified", "qualified", "assessment"],
    ["Qualified → calendar", "calendar", "qualified"], ["Calendar → booked", "bookings", "calendar"],
    ["Booked → show", "shows", "bookings"], ["Show → close", "closed", "shows"],
  ];
  const conversions = transitions.map(([label, numerator, denominator]) => ({
    key: `${numerator}-${denominator}`, label, value: rate(curr(numerator), curr(denominator)),
    previous: rate(prev(numerator), prev(denominator)), format: "percent" as const,
    note: `${curr(numerator)} / ${curr(denominator)}`,
  }));
  const efficiency = [
    ["CPM", spendComparable ? (sum(currentMeta, "impressions") ? (currentSpend! / sum(currentMeta, "impressions")) * 1000 : null) : null],
    ["CPC", cost(currentSpend, spendComparable ? sum(currentMeta, "link_clicks") : null)],
    ["Cost / lead", cost(currentSpend, leads)], ["Cost / portal activation", cost(currentSpend, curr("portal"))],
    ["Cost / video completion", cost(currentSpend, curr("videoComplete"))], ["Cost / assessment", cost(currentSpend, curr("assessment"))],
    ["Cost / qualified lead", cost(currentSpend, curr("qualified"))], ["Cost / appointment", cost(currentSpend, curr("bookings"))],
    ["Cost / show", cost(currentSpend, curr("shows"))], ["Customer acquisition cost", cost(currentSpend, curr("closed"))],
  ].map(([label, value], index) => ({ key: `eff-${index}`, label: label as string, value: value as number | null, previous: null, format: "currency" as const }));

  const adMap = new Map<string, AdPerformanceRow>();
  for (const stat of currentMeta) {
    const key = stat.ad_id;
    const row = adMap.get(key) ?? { key, campaign: stat.campaign_name, adset: stat.adset_name, ad: stat.ad_name, spend: 0, impressions: 0, clicks: 0, leads: 0, portal: 0, completed: 0, assessments: 0, qualified: 0, bookings: 0, shows: 0, closed: 0 };
    row.spend += Number(stat.spend); row.impressions += Number(stat.impressions); row.clicks += Number(stat.link_clicks);
    adMap.set(key, row);
  }
  for (const row of currentRows) {
    const key = row.lead.facebook_ad_id || row.lead.ad || "unattributed";
    const ad = adMap.get(key) ?? { key, campaign: row.lead.campaign || row.lead.facebook_campaign_id || "Unattributed", adset: row.lead.ad_set || row.lead.facebook_adset_id || "—", ad: row.lead.ad || row.lead.facebook_ad_id || "Unattributed", spend: 0, impressions: 0, clicks: 0, leads: 0, portal: 0, completed: 0, assessments: 0, qualified: 0, bookings: 0, shows: 0, closed: 0 };
    ad.leads += 1;
    if (eventual(row, "portal")) ad.portal += 1; if (eventual(row, "videoComplete")) ad.completed += 1;
    if (eventual(row, "assessment")) ad.assessments += 1; if (eventual(row, "qualified")) ad.qualified += 1;
    if (eventual(row, "bookings")) ad.bookings += 1; if (eventual(row, "shows")) ad.shows += 1; if (eventual(row, "closed")) ad.closed += 1;
    adMap.set(key, ad);
  }

  const pageMap = new Map<string, PagePerformanceRow>();
  for (const row of currentRows) {
    const key = pageFor(row);
    const page = pageMap.get(key) ?? { page: key, leads: 0, portal: 0, videoStarts: 0, videoCompletes: 0, assessments: 0, qualified: 0, bookings: 0 };
    page.leads += 1; if (eventual(row, "portal")) page.portal += 1; if (eventual(row, "videoStart")) page.videoStarts += 1;
    if (eventual(row, "videoComplete")) page.videoCompletes += 1; if (eventual(row, "assessment")) page.assessments += 1;
    if (eventual(row, "qualified")) page.qualified += 1; if (eventual(row, "bookings")) page.bookings += 1;
    pageMap.set(key, page);
  }

  const trendMap = new Map<string, TrendPoint>();
  for (let time = currentStart.getTime(); time < currentEnd.getTime(); time += DAY) {
    const date = isoDay(new Date(time)); trendMap.set(date, { date, leads: 0, qualified: 0, bookings: 0, spend: 0 });
  }
  for (const row of currentRows) {
    const date = isoDay(new Date(row.lead.created_at)); const point = trendMap.get(date); if (!point) continue;
    point.leads += 1; if (eventual(row, "qualified")) point.qualified += 1; if (eventual(row, "bookings")) point.bookings += 1;
  }
  for (const stat of currentMeta) { const point = trendMap.get(stat.date); if (point) point.spend += Number(stat.spend); }

  const biggestLeak = conversions.filter((metric) => metric.value !== null).sort((a, b) => (a.value ?? 100) - (b.value ?? 100))[0];
  const leadsOutput: AnalyticsLeadRow[] = currentRows.map((row) => ({
    id: row.lead.id, name: `${row.lead.first_name} ${row.lead.last_name}`, brand: row.brand?.name ?? "Unassigned brand",
    source: row.lead.first_utm_source || row.lead.source || "Direct", campaign: row.lead.campaign || row.lead.first_utm_campaign || "—",
    ad: row.lead.ad || row.lead.facebook_ad_id || "—", page: pageFor(row), portal: eventual(row, "portal"),
    video: row.video?.highest_percent_watched ?? 0, assessment: eventual(row, "assessment"),
    qualification: row.lead.qualification_result || "Pending", advisor: row.advisor ? `${row.advisor.first_name} ${row.advisor.last_name}` : "Unassigned",
    appointment: row.appointments[0]?.status || (row.lead.booked_at ? "BOOKED" : "—"), created: row.lead.created_at,
  }));
  return {
    filters, previousRange: { start: isoDay(previous.start), end: isoDay(new Date(previous.end.getTime() - DAY)) },
    metaConnected, freshness: settings.meta_reporting_last_sync_success_at, currency: settings.meta_reporting_currency || "USD",
    metrics: filters.compare ? metrics : metrics.map((metric) => ({ ...metric, previous: null })),
    funnel: filters.compare ? funnel : funnel.map((stage) => ({ ...stage, previous: null })),
    conversions: filters.compare ? conversions : conversions.map((metric) => ({ ...metric, previous: null })),
    efficiency, trend: [...trendMap.values()], ads: [...adMap.values()].sort((a, b) => b.spend - a.spend || b.leads - a.leads),
    pages: [...pageMap.values()].sort((a, b) => b.leads - a.leads), leads: leadsOutput.sort((a, b) => b.created.localeCompare(a.created)),
    filterOptions: {
      brand: option(allRows.map((row) => row.brand?.name ?? "Unassigned brand")), source: option(allRows.map((row) => row.lead.first_utm_source || row.lead.source)),
      campaign: option([...allRows.map((row) => row.lead.facebook_campaign_id || funnelFor(row)), ...metaStats.map((row) => row.campaign_id)]), adset: option([...allRows.map((row) => row.lead.facebook_adset_id || row.lead.ad_set), ...metaStats.map((row) => row.adset_id)]),
      ad: option([...allRows.map((row) => row.lead.facebook_ad_id || row.lead.ad), ...metaStats.map((row) => row.ad_id)]), funnel: option(allRows.map(funnelFor)), segment: option(allRows.map(segmentFor)),
      page: option(allRows.map(pageFor)), advisor: option(allRows.map((row) => row.lead.assigned_advisor_id)), status: option(allRows.map((row) => row.lead.status)),
    },
    filterLabels: {
      campaign: Object.fromEntries([
        ...allRows.map((row) => [row.lead.facebook_campaign_id, row.lead.campaign || row.lead.first_utm_campaign]),
        ...metaStats.map((row) => [row.campaign_id, row.campaign_name]),
      ].filter((entry): entry is [string, string] => Boolean(entry[0] && entry[1]))),
      adset: Object.fromEntries([
        ...allRows.map((row) => [row.lead.facebook_adset_id, row.lead.ad_set]),
        ...metaStats.map((row) => [row.adset_id, row.adset_name]),
      ].filter((entry): entry is [string, string] => Boolean(entry[0] && entry[1]))),
      ad: Object.fromEntries([
        ...allRows.map((row) => [row.lead.facebook_ad_id, row.lead.ad]),
        ...metaStats.map((row) => [row.ad_id, row.ad_name]),
      ].filter((entry): entry is [string, string] => Boolean(entry[0] && entry[1]))),
      advisor: Object.fromEntries(allRows.filter((row) => row.advisor).map((row) => [row.advisor!.id, `${row.advisor!.first_name} ${row.advisor!.last_name}`])),
    },
    funnelWatch: biggestLeak ? { title: biggestLeak.label, current: biggestLeak.value!, previous: filters.compare ? biggestLeak.previous : null, change: filters.compare && biggestLeak.previous !== null ? biggestLeak.value! - biggestLeak.previous : null } : null,
    diagnostics: [
      metaConnected ? "Meta Ads reporting is connected." : "Meta Ads reporting is not connected; spend and cost metrics are intentionally blank.",
      metaResult.error ? "The Meta reporting database migration has not been verified; delivery and spend data remain unavailable until it is applied." : "Meta reporting storage is ready.",
      downstreamOnlyFilter ? "Meta spend is intentionally blank under source, funnel, segment, page, advisor, or lead-status filters because those dimensions cannot be joined to delivery data without inventing attribution." : "Meta delivery data is aligned to the selected account, brand, campaign, ad set, and ad filters.",
      bridgeCurrent === null ? "Anonymous bridge-visit data is unavailable." : `Anonymous bridge visits are available through ${filters.end}.`,
      bridgeComparable ? "Anonymous bridge visits are date-scoped only." : "Anonymous bridge visits are intentionally blank while lead-level filters are active because those visits cannot be reliably joined before identity capture.",
      "Revenue and ROAS are unavailable because no canonical revenue field exists yet.",
      "Closed/won uses the existing CLOSED_INVESTED opportunity stage; no close value is fabricated.",
    ],
  };
}
