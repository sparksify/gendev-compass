import { META_GRAPH_API_VERSION } from "@/lib/config/tracking";
import { getStore } from "@/lib/store";
import {
  resolveMetaReportingAccessToken,
  resolveMetaReportingAdAccountId,
} from "@/lib/tracking/settings";
import type { TrackingSettingsRecord } from "@/types/tracking";
import type { UpsertMetaAdDailyStatInput } from "@/types/analyticsReporting";

interface MetaAction { action_type?: string; value?: string }
interface MetaInsightRow {
  date_start?: string;
  account_id?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  cpm?: string;
  clicks?: string;
  inline_link_clicks?: string;
  ctr?: string;
  cpc?: string;
  actions?: MetaAction[];
}

interface MetaInsightsResponse {
  data?: MetaInsightRow[];
  paging?: { next?: string };
  error?: { message?: string; code?: number };
}

const FIELDS = [
  "date_start", "account_id", "campaign_id", "campaign_name", "adset_id", "adset_name",
  "ad_id", "ad_name", "spend", "impressions", "reach", "frequency", "cpm", "clicks",
  "inline_link_clicks", "ctr", "cpc", "actions",
].join(",");

const LEAD_ACTIONS = new Set([
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
]);

function number(value: string | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function metaLeads(actions: MetaAction[] | undefined): number {
  return (actions ?? []).reduce(
    (total, action) => total + (action.action_type && LEAD_ACTIONS.has(action.action_type) ? number(action.value) : 0),
    0,
  );
}

function normalizeAccountId(input: string): string {
  const digits = input.replace(/^act_/, "").replace(/\D/g, "");
  if (!digits) throw new Error("Meta Ad Account ID must be numeric.");
  return digits;
}

function insightUrl(accountId: string, token: string, since: string, until: string): string {
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/act_${accountId}/insights`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("level", "ad");
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("limit", "500");
  url.searchParams.set("fields", FIELDS);
  url.searchParams.set("time_range", JSON.stringify({ since, until }));
  url.searchParams.set("use_account_attribution_setting", "true");
  return url.toString();
}

async function fetchInsights(initialUrl: string): Promise<MetaInsightRow[]> {
  const rows: MetaInsightRow[] = [];
  let next: string | undefined = initialUrl;
  for (let page = 0; next && page < 100; page += 1) {
    const parsed = new URL(next);
    if (parsed.protocol !== "https:" || parsed.hostname !== "graph.facebook.com") {
      throw new Error("Meta returned an unsafe pagination URL.");
    }
    const response = await fetch(parsed, { cache: "no-store", signal: AbortSignal.timeout(25_000) });
    const body = (await response.json().catch(() => ({}))) as MetaInsightsResponse;
    if (!response.ok || body.error) {
      throw new Error(body.error?.message ?? `Meta Insights returned HTTP ${response.status}.`);
    }
    rows.push(...(body.data ?? []));
    next = body.paging?.next;
  }
  return rows;
}

export async function syncMetaReporting(args: {
  settings: TrackingSettingsRecord;
  since: string;
  until: string;
  brandId?: string | null;
}): Promise<{ rows: number; since: string; until: string }> {
  const token = resolveMetaReportingAccessToken(args.settings);
  const configuredAccount = resolveMetaReportingAdAccountId(args.settings);
  if (!token || !configuredAccount) throw new Error("Meta Ads reporting is not connected.");
  const accountId = normalizeAccountId(configuredAccount);
  const raw = await fetchInsights(insightUrl(accountId, token, args.since, args.until));
  const rows: UpsertMetaAdDailyStatInput[] = raw.flatMap((row) => {
    if (!row.date_start || !row.campaign_id || !row.adset_id || !row.ad_id) return [];
    return [{
      brand_id: args.brandId ?? args.settings.brand_id,
      date: row.date_start,
      ad_account_id: accountId,
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name ?? row.campaign_id,
      adset_id: row.adset_id,
      adset_name: row.adset_name ?? row.adset_id,
      ad_id: row.ad_id,
      ad_name: row.ad_name ?? row.ad_id,
      spend: number(row.spend),
      impressions: number(row.impressions),
      reach: number(row.reach),
      frequency: number(row.frequency),
      cpm: number(row.cpm),
      clicks: number(row.clicks),
      link_clicks: number(row.inline_link_clicks),
      ctr: number(row.ctr),
      cpc: number(row.cpc),
      meta_leads: metaLeads(row.actions),
      currency: args.settings.meta_reporting_currency || "USD",
    }];
  });
  await getStore().upsertMetaAdDailyStats(rows);
  return { rows: rows.length, since: args.since, until: args.until };
}

export async function testMetaReportingConnection(settings: TrackingSettingsRecord) {
  const today = new Date().toISOString().slice(0, 10);
  return syncMetaReporting({ settings, since: today, until: today });
}
