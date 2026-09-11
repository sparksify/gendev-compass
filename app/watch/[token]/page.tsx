import type { Metadata } from "next";
import { BridgePage } from "@/components/bridge/BridgePage";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { getBridgeWistiaMediaId } from "@/lib/config/bridge";
import { resolveBridgeLead } from "@/lib/bridge/lead";

export const metadata: Metadata = {
  title: "See How Complete Mobile Drug Testing Works — In 3 Minutes",
  description:
    "A quick, no-pressure look at the business model, what owners do, and why companies use these services.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The bridge page for a prospect we already know. The token is the same
 * one that opens their portal (/p/[token]), so the /start handoff, the
 * portal link in the lead's email, and the advisor panel all point at one
 * identity: their name is on the page, the video reports to their tracked
 * history, and the assessment never asks for contact details again.
 */
export default async function WatchTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lead = await resolveBridgeLead(token);

  if (!lead) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <InvalidPortal />
      </div>
    );
  }

  return (
    <BridgePage
      mediaId={getBridgeWistiaMediaId()}
      known={{ token: lead.portal_token, firstName: lead.first_name }}
    />
  );
}
