import { HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TerritoryAdvisorClient } from "@/components/territory/TerritoryAdvisorClient";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { loadPortalContext } from "@/lib/portal/context";
import { routeForState } from "@/lib/portal/getPortalState";
import { trackEvent } from "@/lib/portal/events";
import { getStore } from "@/lib/store";
import { getCurrentBrand, fallbackBrandName } from "@/lib/territory/brand";
import { brand } from "@/lib/config/brand";
import { CMDT_PROFILE } from "@/lib/config/opportunity";
import type { TerritoryEvaluationResult } from "@/types/territory";
import type { PortalRoute } from "@/types/portal";

export const dynamic = "force-dynamic";

const HISTORY_LIMIT = 5;

/** Compact brand context for the workspace header (replaces the rail card). */
function snapshotValue(key: string): string | null {
  return CMDT_PROFILE.snapshot.entries.find((entry) => entry.key === key)?.value ?? null;
}

/**
 * The step a review request should route a prospect to first, when they
 * haven't completed their qualification profile yet — whichever of
 * video/questionnaire resumeRoute says is next (lib/portal/getPortalState.ts
 * already derives that from real progress). Only ever read when
 * !questionnaireCompleted, where resumeRoute is guaranteed to be "overview"
 * or "questionnaire"; the fallback exists only to keep this total.
 */
function nextStepFor(token: string, resumeRoute: PortalRoute) {
  if (resumeRoute === "questionnaire") {
    return { label: "the Qualification Questionnaire", href: routeForState(token, "questionnaire") };
  }
  return { label: "the Investor Overview video", href: routeForState(token, "overview") };
}

/**
 * Client-facing Territory Advisor: a conversational preliminary
 * territory-screening tool. Available as soon as the portal opens — it
 * doesn't gate on questionnaire completion, since it's an engagement tool in
 * its own right (see build spec's "increase buyer engagement" goal).
 */
export default async function TerritoryAdvisorPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = await loadPortalContext(token);
  if (!context) return <InvalidPortal />;
  const { lead, state } = context;
  const nextStep = nextStepFor(token, state.resumeRoute);

  await trackEvent(lead, "territory_advisor_viewed", null, "territory-advisor");

  const franchiseBrand = await getCurrentBrand();

  if (!franchiseBrand) {
    return (
      <div className="max-w-xl">
        <h1 className="font-serif text-3xl font-normal text-foreground">Territory Intelligence</h1>
        <Card className="mt-5 p-6">
          <div className="flex items-start gap-3">
            <HelpCircle className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={1.7} />
            <div>
              <p className="text-[13.5px] font-medium text-foreground">
                Territory screening isn&apos;t set up for {fallbackBrandName()} yet.
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                A member of the GenDev team can help directly — reach out to {brand.advisorName} at{" "}
                <a href={`mailto:${brand.advisorEmail}`} className="text-primary hover:text-primary-hover">
                  {brand.advisorEmail}
                </a>
                .
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const priorSearches = (await getStore().listTerritorySearchesForLead(lead.id))
    .filter((s) => s.brand_id === franchiseBrand.id)
    .slice(0, HISTORY_LIMIT);
  const initialResults = priorSearches
    .map((s) => s.result_summary as TerritoryEvaluationResult | null)
    .filter((r): r is TerritoryEvaluationResult => r != null);

  return (
    <div className="space-y-5">
      <TerritoryAdvisorClient
        token={token}
        firstName={lead.first_name}
        brandName={franchiseBrand.name}
        advisorName={brand.advisorName}
        advisorEmail={brand.advisorEmail}
        brandContext={{
          industry: snapshotValue("industry"),
          investmentRange: snapshotValue("investment"),
        }}
        defaultRadiusMiles={franchiseBrand.default_radius_miles}
        initialResults={initialResults}
        questionnaireCompleted={state.questionnaireCompleted}
        nextStepLabel={nextStep.label}
        nextStepHref={nextStep.href}
      />
    </div>
  );
}
