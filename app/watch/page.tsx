import type { Metadata } from "next";
import { headers } from "next/headers";
import { BridgePage } from "@/components/bridge/BridgePage";
import { getBridgeWistiaMediaId } from "@/lib/config/bridge";
import { recordAnonymousBridgeVisit } from "@/lib/bridge/visits";

export const metadata: Metadata = {
  title: "See How Complete Mobile Drug Testing Works — In 3 Minutes",
  description:
    "A quick, no-pressure look at the business model, what owners do, and why companies use these services.",
  robots: { index: false, follow: false },
};

// The bridge's marketing tag is resolved against each visitor's consent cookie.
export const dynamic = "force-dynamic";

/**
 * The anonymous bridge page: cold traffic with no lead on file. Submitting
 * the assessment creates the lead. Prospects who already exist (the
 * Facebook lead ad → /start handoff) land on /watch/[token] instead.
 *
 * Every open is counted (lib/bridge/visits.ts) so the advisor dashboard can
 * show bridge traffic even though these visitors are not leads yet.
 */
export default async function WatchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, requestHeaders] = await Promise.all([searchParams, headers()]);
  await recordAnonymousBridgeVisit({
    path: "/watch",
    userAgent: requestHeaders.get("user-agent"),
    referrer: requestHeaders.get("referer"),
    searchParams: params,
  });

  return <BridgePage mediaId={getBridgeWistiaMediaId()} />;
}
