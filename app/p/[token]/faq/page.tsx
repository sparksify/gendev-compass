import { InvestorFAQ } from "@/components/dashboard/InvestorFAQ";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { loadPortalContext } from "@/lib/portal/context";
import { trackEvent } from "@/lib/portal/events";

export const dynamic = "force-dynamic";

export default async function FaqPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = await loadPortalContext(token);
  if (!context) return <InvalidPortal />;
  await trackEvent(context.lead, "faq_opened", null, "faq");
  return <InvestorFAQ token={token} />;
}
