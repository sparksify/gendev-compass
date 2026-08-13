import type { PortalEventName } from "@/types/analytics";

/**
 * Tracking & Attribution domain types (Phase 11). See
 * docs/tracking-attribution.md for the architecture this backs.
 */

export type MetaBrowserMode = "gtm" | "direct" | "server_only";
export type MarketingDefault = "granted" | "denied";

/** Per-event provider toggles + Meta event name override, stored as JSON on tracking_settings.event_overrides. */
export interface TrackingEventOverride {
  gtm?: boolean;
  metaBrowser?: boolean;
  metaCapi?: boolean;
  metaEventName?: string | null;
}

export type TrackingEventOverrides = Partial<Record<PortalEventName, TrackingEventOverride>>;

export interface TrackingSettingsRecord {
  id: string;
  brand_id: string | null;

  gtm_enabled: boolean;
  gtm_container_id: string | null;

  meta_enabled: boolean;
  meta_browser_mode: MetaBrowserMode;
  meta_pixel_id: string | null;

  meta_capi_enabled: boolean;
  /** Never returned to the client — presence only, via meta_capi_access_token_configured. */
  meta_capi_access_token_ciphertext: string | null;
  meta_test_event_code: string | null;

  consent_required: boolean;
  marketing_tracking_default: MarketingDefault;

  event_overrides: TrackingEventOverrides;

  last_gtm_test_at: string | null;
  last_meta_browser_test_at: string | null;
  last_meta_capi_success_at: string | null;
  last_meta_capi_failure_at: string | null;
  last_meta_capi_error: string | null;

  created_at: string;
  updated_at: string;
}

/** Patchable admin-settable fields. The ciphertext is set via a dedicated setter (see lib/tracking/settings.ts) so plaintext tokens never round-trip through generic patch code. */
export type TrackingSettingsPatch = Partial<
  Pick<
    TrackingSettingsRecord,
    | "gtm_enabled"
    | "gtm_container_id"
    | "meta_enabled"
    | "meta_browser_mode"
    | "meta_pixel_id"
    | "meta_capi_enabled"
    | "meta_test_event_code"
    | "consent_required"
    | "marketing_tracking_default"
    | "event_overrides"
    | "last_gtm_test_at"
    | "last_meta_browser_test_at"
    | "last_meta_capi_success_at"
    | "last_meta_capi_failure_at"
    | "last_meta_capi_error"
    | "meta_capi_access_token_ciphertext"
  >
>;

export type TrackingProvider = "gtm" | "meta_browser" | "meta_capi";
export type TrackingDeliveryMode = "browser" | "server";
export type TrackingDeliveryStatus = "sent" | "skipped" | "failed" | "suppressed" | "test";

export interface TrackingDeliveryRecord {
  id: string;
  portal_event_id: string | null;
  lead_id: string | null;
  provider: TrackingProvider;
  event_name: string;
  external_event_name: string | null;
  event_id: string;
  delivery_mode: TrackingDeliveryMode;
  status: TrackingDeliveryStatus;
  attempt_count: number;
  next_attempt_at: string | null;
  response_code: number | null;
  /** Provider response, sanitized — never contains the access token. */
  provider_response: Record<string, unknown> | null;
  sent_at: string | null;
  failed_at: string | null;
  created_at: string;
}

export interface CreateTrackingDeliveryInput {
  portal_event_id?: string | null;
  lead_id?: string | null;
  provider: TrackingProvider;
  event_name: string;
  external_event_name?: string | null;
  event_id: string;
  delivery_mode: TrackingDeliveryMode;
  status: TrackingDeliveryStatus;
  attempt_count?: number;
  next_attempt_at?: string | null;
  response_code?: number | null;
  provider_response?: Record<string, unknown> | null;
  sent_at?: string | null;
  failed_at?: string | null;
}

export type TrackingDeliveryPatch = Partial<
  Pick<
    TrackingDeliveryRecord,
    | "status"
    | "attempt_count"
    | "next_attempt_at"
    | "response_code"
    | "provider_response"
    | "sent_at"
    | "failed_at"
  >
>;

export type ConsentCategory = "necessary" | "analytics" | "marketing";

export interface ConsentRecord {
  id: string;
  lead_id: string | null;
  portal_token: string | null;
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  consent_version: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface CreateConsentInput {
  lead_id?: string | null;
  portal_token?: string | null;
  necessary?: boolean;
  analytics: boolean;
  marketing: boolean;
  consent_version: string;
  ip_address?: string | null;
  user_agent?: string | null;
}
