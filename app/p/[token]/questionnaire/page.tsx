import { redirect } from "next/navigation";
import { loadPortalContext } from "@/lib/portal/context";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { PortalProgress } from "@/components/portal/PortalProgress";
import { QuestionnaireForm } from "@/components/portal/QuestionnaireForm";
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
      <PortalProgress items={state.checklist} />

      <div>
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
          Qualification Questionnaire
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          {lead.first_name}, your next step is ready. Your answers help us prepare a consultation
          focused on your specific goals. All responses are confidential.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-white p-5 sm:p-8">
        <QuestionnaireForm token={token} />
      </div>
    </div>
  );
}
