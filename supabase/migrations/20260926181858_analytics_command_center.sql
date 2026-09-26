-- Analytics Command Center: Meta reporting configuration and one canonical
-- daily ad-grain fact table. Campaign/ad-set reporting aggregates these rows,
-- which prevents spend from being counted once at every hierarchy level.

alter table public.tracking_settings
  add column if not exists meta_reporting_enabled boolean not null default false,
  add column if not exists meta_reporting_ad_account_id text,
  add column if not exists meta_reporting_access_token_ciphertext text,
  add column if not exists meta_reporting_timezone text not null default 'America/Chicago',
  add column if not exists meta_reporting_currency text not null default 'USD',
  add column if not exists meta_reporting_attribution_window text not null default 'account_default',
  add column if not exists meta_reporting_last_sync_attempt_at timestamptz,
  add column if not exists meta_reporting_last_sync_success_at timestamptz,
  add column if not exists meta_reporting_last_sync_status text,
  add column if not exists meta_reporting_last_sync_error text;

create table if not exists public.meta_ad_daily_stats (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.franchise_brands(id) on delete set null,
  date date not null,
  ad_account_id text not null,
  campaign_id text not null,
  campaign_name text not null default '',
  adset_id text not null,
  adset_name text not null default '',
  ad_id text not null,
  ad_name text not null default '',
  spend numeric(14,2) not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  frequency numeric(12,4) not null default 0,
  cpm numeric(14,4) not null default 0,
  clicks bigint not null default 0,
  link_clicks bigint not null default 0,
  ctr numeric(12,4) not null default 0,
  cpc numeric(14,4) not null default 0,
  meta_leads bigint not null default 0,
  currency text not null default 'USD',
  synced_at timestamptz not null default now()
);

create unique index if not exists meta_ad_daily_stats_identity_idx
  on public.meta_ad_daily_stats (brand_id, date, ad_account_id, ad_id) nulls not distinct;
create index if not exists meta_ad_daily_stats_date_idx
  on public.meta_ad_daily_stats (date desc);
create index if not exists meta_ad_daily_stats_campaign_idx
  on public.meta_ad_daily_stats (campaign_id, date desc);
create index if not exists meta_ad_daily_stats_adset_idx
  on public.meta_ad_daily_stats (adset_id, date desc);

alter table public.meta_ad_daily_stats enable row level security;
revoke all on table public.meta_ad_daily_stats from anon, authenticated;
