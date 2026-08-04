import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { QuestionnaireForm } from "@/components/forms/QuestionnaireForm";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { loadPortalContext } from "@/lib/portal/context";
import { trackEvent } from "@/lib/portal/events";

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
          <QuestionnaireForm token={token} />
        </CardContent>
      </Card>
    </div>
  );
}
