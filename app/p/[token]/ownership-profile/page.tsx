import { OwnershipProfileAssessment } from "@/components/portal/OwnershipProfileAssessment";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { loadPortalContext } from "@/lib/portal/context";
import { trackEvent } from "@/lib/portal/events";

export const dynamic = "force-dynamic";

/**
 * Ownership Profile — a consultative, locally-persisted assessment. It does
 * not qualify investors; it helps them articulate what they want from
 * ownership while giving GenDev Compass a foundation to later personalize
 * resources, FAQs, the advisor dashboard, and AI chat (not built yet — see
 * types/ownershipProfile.ts and hooks/useOwnershipProfileStorage.ts).
 */
export default async function OwnershipProfilePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await loadPortalContext(token);
  if (!context) return <InvalidPortal />;

  await trackEvent(context.lead, "ownership_profile_opened", null, "ownership-profile");

  return (
    <div className="space-y-[18px]">
      <div>
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-accent-gold">
          Investor Insights
        </p>
        <h1 className="mt-1.5 font-serif text-[32px] font-normal leading-[1.1] tracking-[-0.01em] text-foreground sm:text-[38px]">
          Ownership Profile
        </h1>
        <p className="mt-2.5 max-w-[38rem] text-[13.5px] leading-[1.65] text-muted-foreground">
          Discover the ownership style, goals, and business characteristics that matter most to
          you. Your responses help personalize your due diligence experience.
        </p>
      </div>

      <OwnershipProfileAssessment token={token} />
    </div>
  );
}
