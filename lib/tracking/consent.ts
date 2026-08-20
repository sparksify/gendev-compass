import { cookies } from "next/headers";
import { isProduction } from "@/lib/config/env";
import type { MarketingDefault } from "@/types/tracking";

/**
 * Basic consent framework (spec §20). Categories: necessary (always on),
 * analytics, marketing. Necessary portal functionality works regardless of
 * analytics/marketing consent; when the configured policy requires
 * marketing consent, Meta Pixel / advertising tags must not load before it.
 *
 * This is placeholder consent copy and logic — jurisdiction-specific legal
 * requirements are NOT invented here; review with counsel before relying on
 * this for GDPR/CCPA/etc. compliance (see docs/tracking-attribution.md).
 */

export const CONSENT_COOKIE_NAME = "gdc_consent";
export const CONSENT_VERSION = "v1";

export interface ConsentCookieState {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  version: string;
}

export async function readConsentCookie(): Promise<ConsentCookieState | null> {
  const store = await cookies();
  const raw = store.get(CONSENT_COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentCookieState>;
    return {
      necessary: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      version: parsed.version ?? CONSENT_VERSION,
    };
  } catch {
    return null;
  }
}

export async function writeConsentCookie(state: { analytics: boolean; marketing: boolean }): Promise<void> {
  const store = await cookies();
  store.set(CONSENT_COOKIE_NAME, JSON.stringify({ ...state, version: CONSENT_VERSION }), {
    httpOnly: false,
    secure: isProduction(),
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
}

/**
 * Whether marketing tracking (Meta Pixel, GTM advertising tags, retargeting)
 * may load. Necessary/analytics tracking is never gated by this — only
 * marketing per spec §20.
 */
export function marketingAllowed(
  consentRequired: boolean,
  consent: ConsentCookieState | null,
  marketingDefault: MarketingDefault,
): boolean {
  if (!consentRequired) return true;
  if (consent) return consent.marketing;
  return marketingDefault === "granted";
}
