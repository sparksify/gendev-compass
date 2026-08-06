import { redirect } from "next/navigation";
import { Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

const CHIPS = ["Confidential", "Personalized", "About 5 Minutes"];

export const dynamic = "force-dynamic";

export default async function QuestionnairePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = await loadPortalContext(token);
  if (!context) return <InvalidPortal />;
  const { lead, state } = context;
  if (state.questionnaireCompleted || state.booked) redirect(`/p/${token}/schedule`);
  await trackEvent(lead, "questionnaire_opened", null, "questionnaire");
  const defaults: Partial<Pick<QuestionnairePayload, "liquidCapital" | "netWorth">> = {
    liquidCapital: knownValue(LIQUID_CAPITAL_RANGES, lead.initial_liquid_capital),
    netWorth: knownValue(NET_WORTH_RANGES, lead.initial_net_worth),
  };
  return (
    <div className="space-y-[18px]">
      <div>
        <h1 className="font-serif text-4xl font-normal leading-[1.1] tracking-[-0.01em] text-foreground sm:text-[42px]">
          Let&rsquo;s Prepare for Your Consultation
        </h1>
        <p className="mt-3 max-w-xl text-[13.5px] leading-[1.65] text-muted-foreground">
          These questions help your advisor prepare a personalized consultation focused on your
          investment goals, timeline, and experience. Your responses are confidential and
          typically take about 3–5 minutes to complete.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {CHIPS.map((chip) => (
            <Badge
              key={chip}
              variant="outline"
              className="border-border-soft py-1 text-[11.5px] font-medium text-muted-foreground"
            >
              <span aria-hidden className="text-success">
                ✓
              </span>
              {chip}
            </Badge>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-6 sm:p-8">
          <InvestorProfileSummary lead={lead} />
        </CardContent>
      </Card>

      <Card className="border-primary-soft-border bg-primary-soft/40">
        <CardContent className="flex gap-3.5 p-6 sm:p-7">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-primary">
            <Info className="size-4" strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-[14px] font-bold text-foreground">
              Why we&rsquo;re asking these questions
            </h2>
            <p className="mt-1.5 text-[13px] leading-[1.65] text-muted-foreground">
              Every investor&rsquo;s goals are different — some are looking for executive
              ownership, others want a semi-passive income stream, and some are building a
              multi-unit portfolio. Your answers help {brand.advisorName} understand what matters
              most to you, so your consultation is tailored to your goals rather than a generic
              walkthrough.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 sm:p-8">
          <QuestionnaireForm token={token} advisorName={brand.advisorName} defaults={defaults} />
        </CardContent>
      </Card>
    </div>
  );
}
