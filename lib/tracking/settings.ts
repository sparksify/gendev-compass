import { getStore } from "@/lib/store";
import { decryptSecret, encryptSecret, trackingEncryptionAvailable } from "@/lib/tracking/crypto";
import {
  getGtmContainerIdEnvFallback,
  getMetaCapiAccessTokenEnvFallback,
  getMetaPixelIdEnvFallback,
  getMetaTestEventCodeEnvFallback,
} from "@/lib/config/tracking";
import type { TrackingSettingsRecord } from "@/types/tracking";

/**
 * The effective tracking configuration: the admin-saved row in
 * tracking_settings, with NEXT_PUBLIC_GTM_CONTAINER_ID /
 * NEXT_PUBLIC_META_PIXEL_ID / META_CAPI_ACCESS_TOKEN / META_TEST_EVENT_CODE
 * env vars as deploy-time fallbacks only where the admin hasn't set a value
 * (spec §28). Admin values always win when present.
 */
export interface EffectiveTrackingSettings {
  raw: TrackingSettingsRecord;
  gtmEnabled: boolean;
  gtmContainerId: string | null;
  metaEnabled: boolean;
  metaBrowserMode: TrackingSettingsRecord["meta_browser_mode"];
  metaPixelId: string | null;
  metaCapiEnabled: boolean;
  metaCapiAccessTokenConfigured: boolean;
  metaTestEventCode: string | null;
  consentRequired: boolean;
  marketingTrackingDefault: TrackingSettingsRecord["marketing_tracking_default"];
}

export async function getEffectiveTrackingSettings(): Promise<EffectiveTrackingSettings> {
  const raw = await getStore().getTrackingSettings();
  const gtmContainerId = raw.gtm_container_id ?? getGtmContainerIdEnvFallback();
  const metaPixelId = raw.meta_pixel_id ?? getMetaPixelIdEnvFallback();
  const tokenConfigured = Boolean(raw.meta_capi_access_token_ciphertext) || Boolean(getMetaCapiAccessTokenEnvFallback());

  return {
    raw,
    gtmEnabled: raw.gtm_enabled && Boolean(gtmContainerId),
    gtmContainerId,
    metaEnabled: raw.meta_enabled && Boolean(metaPixelId),
    metaBrowserMode: raw.meta_browser_mode,
    metaPixelId,
    metaCapiEnabled: raw.meta_capi_enabled && tokenConfigured && Boolean(metaPixelId),
    metaCapiAccessTokenConfigured: tokenConfigured,
    metaTestEventCode: raw.meta_test_event_code ?? getMetaTestEventCodeEnvFallback(),
    consentRequired: raw.consent_required,
    marketingTrackingDefault: raw.marketing_tracking_default,
  };
}

/** Server-only: the plaintext CAPI token, decrypted, or the env fallback. Never send this to the client. */
export function resolveMetaCapiAccessToken(settings: TrackingSettingsRecord): string | null {
  if (settings.meta_capi_access_token_ciphertext) {
    const decrypted = decryptSecret(settings.meta_capi_access_token_ciphertext);
    if (decrypted) return decrypted;
  }
  return getMetaCapiAccessTokenEnvFallback();
}

/** Encrypts and saves a new Meta CAPI access token. Throws if TRACKING_ENCRYPTION_KEY is not configured. */
export async function saveMetaCapiAccessToken(settingsId: string, plaintextToken: string): Promise<void> {
  if (!trackingEncryptionAvailable()) {
    throw new Error(
      "TRACKING_ENCRYPTION_KEY is not configured — set it to a 32-byte key before saving a token through the admin UI, or set META_CAPI_ACCESS_TOKEN as a deploy-time env var instead.",
    );
  }
  const ciphertext = encryptSecret(plaintextToken);
  await getStore().updateTrackingSettings(settingsId, { meta_capi_access_token_ciphertext: ciphertext });
}

export async function clearMetaCapiAccessToken(settingsId: string): Promise<void> {
  await getStore().updateTrackingSettings(settingsId, { meta_capi_access_token_ciphertext: null });
}

/** Client-safe subset — no secrets, no server-only identifiers beyond public pixel/container IDs. */
export interface PublicTrackingConfig {
  gtmEnabled: boolean;
  gtmContainerId: string | null;
  metaEnabled: boolean;
  metaBrowserMode: TrackingSettingsRecord["meta_browser_mode"];
  metaPixelId: string | null;
  consentRequired: boolean;
  marketingTrackingDefault: TrackingSettingsRecord["marketing_tracking_default"];
}

export function toPublicConfig(settings: EffectiveTrackingSettings): PublicTrackingConfig {
  return {
    gtmEnabled: settings.gtmEnabled,
    gtmContainerId: settings.gtmContainerId,
    metaEnabled: settings.metaEnabled,
    metaBrowserMode: settings.metaBrowserMode,
    // Direct-mode Pixel ID is meant to ship to the browser; GTM/server-only
    // modes don't need it client-side, but exposing it is harmless (it's
    // already public once the pixel fires).
    metaPixelId: settings.metaPixelId,
    consentRequired: settings.consentRequired,
    marketingTrackingDefault: settings.marketingTrackingDefault,
  };
}
