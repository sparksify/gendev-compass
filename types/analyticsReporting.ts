export interface MetaAdDailyStatRecord {
  id: string;
  brand_id: string | null;
  date: string;
  ad_account_id: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  ad_id: string;
  ad_name: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  cpm: number;
  clicks: number;
  link_clicks: number;
  ctr: number;
  cpc: number;
  meta_leads: number;
  currency: string;
  synced_at: string;
}

export type UpsertMetaAdDailyStatInput = Omit<MetaAdDailyStatRecord, "id" | "synced_at">;

export interface MetaStatsFilter {
  startDate: string;
  endDate: string;
  brandId?: string | null;
}
