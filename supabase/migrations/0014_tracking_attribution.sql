-- Tracking & Attribution layer (Phase 11): first/last-touch attribution on
-- leads, admin-configurable tracking settings, delivery diagnostics, and a
-- basic consent log. See docs/tracking-attribution.md.

-- ---------------------------------------------------------------------------
-- leads: attribution columns
-- ---------------------------------------------------------------------------
alter table public.leads
  -- First touch — written once (lead creation or first portal visit) and
  -- never overwritten afterward.
  add column if not exists first_utm_source text,
  add column if not exists first_utm_medium text,
  add column if not exists first_utm_campaign text,
  add column if not exists first_utm_content text,
  add column if not exists first_utm_term text,
  add column if not exists first_fbclid text,
  add column if not exists first_gclid text,
  add column if not exists first_msclkid text,
  add column if not exists first_fbp text,
  add column if not exists first_fbc text,
  add column if not exists first_referrer text,
  add column if not exists first_landing_page text,
  add column if not exists first_touch_at timestamptz,
  -- Latest touch — may update on later qualified visits (e.g. an email
  -- reminder click). The conversion event still carries first-touch values
  -- for advertising reporting; this is for internal "how did they come
  -- back" context only.
  add column if not exists last_utm_source text,
  add column if not exists last_utm_medium text,
  add column if not exists last_utm_campaign text,
  add column if not exists last_utm_content text,
  add column if not exists last_utm_term text,
  add column if not exists last_fbclid text,
  add column if not exists last_referrer text,
  add column if not exists last_landing_page text,
  add column if not exists last_touch_at timestamptz,
  -- Facebook Lead Ads — extended IDs (populated via the lead creation API
  -- today; a direct Lead Ads webhook is a future extension point).
  add column if not exists facebook_campaign_id text,
  add column if not exists facebook_adset_id text,
  add column if not exists facebook_ad_id text,
  add column if not exists facebook_form_id text,
  add column if not exists facebook_page_id text,
  -- Advisor presentation/routing attribution (future multi-advisor
  -- reporting). Never sent to advertising platforms.
  add column if not exists advisor_presented text,
  add column if not exists advisor_selected text,
  add column if not exists advisor_booked text,
  add column if not exists overflow_used boolean not null default false;

create index if not exists leads_first_utm_campaign_idx on public.leads (first_utm_campaign);
create index if not exists leads_first_fbclid_idx on public.leads (first_fbclid);

-- ---------------------------------------------------------------------------
-- tracking_settings — single-row-per-brand admin configuration. brand_id is
-- nullable and unused today (single-brand deployment); the column exists so
-- settings can attach to a brand later without another migration.
-- ---------------------------------------------------------------------------
create table if not exists public.tracking_settings (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.franchise_brands (id) on delete set null,

  gtm_enabled boolean not null default false,
  gtm_container_id text,

  meta_enabled boolean not null default false,
  meta_browser_mode text not null default 'gtm',
  meta_pixel_id text,

  meta_capi_enabled boolean not null default false,
  -- AES-256-GCM ciphertext (base64: iv || authTag || ciphertext); the
  -- plaintext access token is never stored. Encrypted with
  -- TRACKING_ENCRYPTION_KEY (lib/tracking/crypto.ts). Null when the admin
  -- has not saved a token through the UI — META_CAPI_ACCESS_TOKEN env var
  -- can still be used as a deploy-time fallback (lib/tracking/settings.ts).
  meta_capi_access_token_ciphertext text,
  meta_test_event_code text,

  consent_required boolean not null default false,
  marketing_tracking_default text not null default 'denied',

  -- Per-event provider toggles / Meta event name overrides. Keyed by
  -- PortalEventName; see lib/tracking/taxonomy.ts for the coded defaults
  -- this overrides. MVP: admin toggles booleans, event names stay in code.
  event_overrides jsonb not null default '{}'::jsonb,

  last_gtm_test_at timestamptz,
  last_meta_browser_test_at timestamptz,
  last_meta_capi_success_at timestamptz,
  last_meta_capi_failure_at timestamptz,
  last_meta_capi_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tracking_settings_browser_mode_check check (
    meta_browser_mode in ('gtm', 'direct', 'server_only')
  ),
  constraint tracking_settings_marketing_default_check check (
    marketing_tracking_default in ('granted', 'denied')
  )
);

-- One settings row per brand (and one global row where brand_id is null).
create unique index if not exists tracking_settings_brand_unique_idx
  on public.tracking_settings ((coalesce(brand_id::text, 'global')));

-- ---------------------------------------------------------------------------
-- tracking_deliveries — per-provider delivery diagnostics, separate from
-- portal_events so the primary event table stays lean.
-- ---------------------------------------------------------------------------
create table if not exists public.tracking_deliveries (
  id uuid primary key default gen_random_uuid(),
  portal_event_id uuid references public.portal_events (id) on delete set null,
  lead_id uuid references public.leads (id) on delete cascade,
  provider text not null,
  event_name text not null,
  external_event_name text,
  event_id text not null,
  delivery_mode text not null,
  status text not null default 'sent',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  response_code integer,
  -- Sanitized provider response only — never the access token.
  provider_response jsonb,
  sent_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),

  constraint tracking_deliveries_provider_check check (provider in ('gtm', 'meta_browser', 'meta_capi')),
  constraint tracking_deliveries_mode_check check (delivery_mode in ('browser', 'server')),
  constraint tracking_deliveries_status_check check (
    status in ('sent', 'skipped', 'failed', 'suppressed', 'test')
  )
);

create index if not exists tracking_deliveries_lead_id_idx on public.tracking_deliveries (lead_id);
create index if not exists tracking_deliveries_event_id_idx on public.tracking_deliveries (event_id);
create index if not exists tracking_deliveries_status_idx on public.tracking_deliveries (status);
create index if not exists tracking_deliveries_created_at_idx on public.tracking_deliveries (created_at);
create index if not exists tracking_deliveries_retry_idx
  on public.tracking_deliveries (next_attempt_at)
  where status = 'failed';

-- ---------------------------------------------------------------------------
-- portal_consent — append-only consent log (necessary/analytics/marketing).
-- ---------------------------------------------------------------------------
create table if not exists public.portal_consent (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete cascade,
  portal_token text,
  necessary boolean not null default true,
  analytics boolean not null default false,
  marketing boolean not null default false,
  consent_version text not null default 'v1',
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists portal_consent_lead_id_idx on public.portal_consent (lead_id);
create index if not exists portal_consent_portal_token_idx on public.portal_consent (portal_token);
create index if not exists portal_consent_created_at_idx on public.portal_consent (created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security: deny-all by default, same as every other table — only
-- the service-role key (server-side) reads/writes these.
-- ---------------------------------------------------------------------------
alter table public.tracking_settings enable row level security;
alter table public.tracking_deliveries enable row level security;
alter table public.portal_consent enable row level security;
