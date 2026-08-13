import { isProduction } from "./env";

/**
 * Server-side environment access for the tracking layer. These are
 * deploy-time fallbacks only — admin-saved values in tracking_settings
 * (lib/tracking/settings.ts) always take priority. See .env.example.
 */

/** Public GTM container ID fallback (client-visible; safe as NEXT_PUBLIC_). */
export function getGtmContainerIdEnvFallback(): string | null {
  return process.env.NEXT_PUBLIC_GTM_CONTAINER_ID ?? null;
}

/** Public Meta Pixel ID fallback (client-visible; safe as NEXT_PUBLIC_). */
export function getMetaPixelIdEnvFallback(): string | null {
  return process.env.NEXT_PUBLIC_META_PIXEL_ID ?? null;
}

/**
 * Server-only Meta CAPI access token fallback, used when the admin has not
 * saved an encrypted token through /admin/tracking. NEVER read this from
 * client code and never echo it in an API response.
 */
export function getMetaCapiAccessTokenEnvFallback(): string | null {
  return process.env.META_CAPI_ACCESS_TOKEN ?? null;
}

export function getMetaTestEventCodeEnvFallback(): string | null {
  return process.env.META_TEST_EVENT_CODE ?? null;
}

/**
 * 32-byte key (base64 or hex, 32 raw bytes either way) used to encrypt the
 * Meta CAPI access token at rest (lib/tracking/crypto.ts). Without this set,
 * the admin UI cannot save a token directly — only the env var fallback
 * above is usable — so a plaintext secret is never written to the database.
 */
export function getTrackingEncryptionKey(): string | null {
  return process.env.TRACKING_ENCRYPTION_KEY ?? null;
}

/** Verbose [Tracking] console logging — dev/preview only, never production. */
export function trackingDebugEnabled(): boolean {
  if (isProduction()) return false;
  return process.env.TRACKING_DEBUG === "true";
}

export const META_GRAPH_API_VERSION = "v21.0";
