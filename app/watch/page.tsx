import type { Metadata } from "next";
import { BridgePage } from "@/components/bridge/BridgePage";
import { getBridgeWistiaMediaId } from "@/lib/config/bridge";

export const metadata: Metadata = {
  title: "See How Complete Mobile Drug Testing Works — In 3 Minutes",
  description:
    "A quick, no-pressure look at the business model, what owners do, and why companies use these services.",
  robots: { index: false, follow: false },
};

/**
 * The anonymous bridge page: cold traffic with no lead on file. Submitting
 * the assessment creates the lead. Prospects who already exist (the
 * Facebook lead ad → /start handoff) land on /watch/[token] instead.
 */
export default function WatchPage() {
  return <BridgePage mediaId={getBridgeWistiaMediaId()} />;
}
