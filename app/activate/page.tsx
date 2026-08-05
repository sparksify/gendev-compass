import { ActivationScreen } from "@/components/portal/ActivationScreen";
import { getActivationMaxWaitSeconds, getActivationPollIntervalMs } from "@/lib/config/portalActivation";

export const dynamic = "force-dynamic";

interface SearchParams {
  brand?: string;
  form?: string;
  campaign?: string;
  ad?: string;
  page?: string;
  source?: string;
}

/**
 * The Facebook completion-screen destination: /activate?brand=cmdt (see
 * HIGHLEVEL_SETUP.md). Only non-sensitive attribution identifiers ever
 * appear in this URL — no email, phone, or HighLevel contact id.
 */
export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  return (
    <ActivationScreen
      brandSlug={params.brand?.trim() || null}
      formId={params.form?.trim() || null}
      campaignId={params.campaign?.trim() || null}
      adId={params.ad?.trim() || null}
      pageId={params.page?.trim() || null}
      source={params.source?.trim() || null}
      pollIntervalMs={getActivationPollIntervalMs()}
      maxWaitSeconds={getActivationMaxWaitSeconds()}
    />
  );
}
