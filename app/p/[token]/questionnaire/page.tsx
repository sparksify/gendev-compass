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

  // Locked until the video is complete; already-submitted prospects move on.
  if (state.booked || state.reviewRequired) redirect(`/p/${token}/complete`);
  if (state.qualified) redirect(`/p/${token}/schedule`);
  if (!state.videoCompleted) redirect(`/p/${token}/overview`);
  if (state.questionnaireCompleted) redirect(`/p/${token}`);

  await trackEvent(lead, "questionnaire_opened", null, "questionnaire");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Qualification Questionnaire
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {lead.first_name}, your next step is ready. Your answers help us prepare a consultation
          focused on your specific goals. All responses are confidential. This takes about 15
          minutes.
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
