import { getStore } from "@/lib/store";

/**
 * Counts an anonymous open of the bridge page. Nothing else in the funnel
 * can see these visitors — they have no lead until they submit the
 * assessment — so this is the only place "how many people reached the
 * bridge" comes from. Fire-safe: a failure is logged and the page renders.
 *
 * Link-preview fetchers (Facebook, Slack, iMessage…) and crawlers are
 * skipped so the count reflects people, not the scrapers that hit every
 * URL an ad or message contains.
 */

const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|preview|fetch|headless|monitor|lighthouse|python-requests|curl\//i;

function clean(value: string | string[] | undefined | null, max = 200): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const trimmed = raw.trim().slice(0, max);
  return trimmed.length > 0 ? trimmed : null;
}

export async function recordAnonymousBridgeVisit(input: {
  path: string;
  userAgent: string | null;
  referrer: string | null;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<void> {
  if (input.userAgent && BOT_UA.test(input.userAgent)) return;
  try {
    await getStore().recordBridgeVisit({
      path: input.path,
      referrer: clean(input.referrer, 500),
      utm_source: clean(input.searchParams.utm_source),
      utm_medium: clean(input.searchParams.utm_medium),
      utm_campaign: clean(input.searchParams.utm_campaign),
    });
  } catch (error) {
    console.error("[bridge] failed to record anonymous visit:", error);
  }
}
