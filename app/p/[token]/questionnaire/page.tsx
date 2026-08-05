import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { QuestionnaireForm } from "@/components/forms/QuestionnaireForm";
import { InvestorProfileSummary } from "@/components/forms/InvestorProfileSummary";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { loadPortalContext } from "@/lib/portal/context";
import { brand } from "@/lib/config/brand";
import { trackEvent } from "@/lib/portal/events";
import { LIQUID_CAPITAL_RANGES, NET_WORTH_RANGES } from "@/types/questionnaire";
import type { QuestionnairePayload } from "@/lib/validation/questionnaire";

function knownValue<T extends string>(
  options: ReadonlyArray<{ value: T }>,
  value: string | null,
): T | undefined {
  return options.some((option) => option.value === value) ? (value as T) : undefined;
}

export const dynamic = "force-dynamic";

export default async function QuestionnairePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await loadPortalContext(token);
  if (!context) return <InvalidPortal />;

  const { lead, state } = context;

  // Open to every prospect (the overview is optional); already-submitted
  // prospects move on to their state-appropriate page.
  if (state.booked || state.reviewRequired) redirect(`/p/${token}/complete`);
  if (state.qualified) redirect(`/p/${token}/schedule`);
  if (state.questionnaireCompleted) redirect(`/p/${token}`);

  await trackEvent(lead, "questionnaire_opened", null, "questionnaire");

  // Answers captured with the original application pre-fill the form so the
  // prospect confirms rather than re-enters them.
  const defaults: Partial<Pick<QuestionnairePayload, "liquidCapital" | "netWorth">> = {
    liquidCapital: knownValue(LIQUID_CAPITAL_RANGES, lead.initial_liquid_capital),
    netWorth: knownValue(NET_WORTH_RANGES, lead.initial_net_worth),
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-4xl font-normal leading-[1.1] tracking-[-0.01em] text-foreground sm:text-[42px]">
          Prepare for Your Consultation
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {lead.first_name}, these questions help your advisor prepare a personalized consultation
          focused on your investment objectives and experience. All responses are confidential.
          Most investors complete this in about 3–5 minutes.
        </p>
      </div>

      <Card>
        <CardContent className="p-6 sm:p-8">
          <InvestorProfileSummary lead={lead} />

          <div className="my-6 border-t border-border-soft" aria-hidden />

          <div className="mb-6">
            <h2 className="text-[15.5px] font-bold text-foreground">Consultation Preparation</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              A few questions from {brand.advisorName} to tailor the conversation to your goals.
            </p>
          </div>

          <QuestionnaireForm token={token} defaults={defaults} />
        </CardContent>
      </Card>
    </div>
  );
}
