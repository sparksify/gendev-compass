import Link from "next/link";
import { loadPortalContext } from "@/lib/portal/context";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { PortalStatusCard } from "@/components/portal/PortalStatusCard";
import { StepChecklist } from "@/components/portal/StepChecklist";
import { brand } from "@/lib/config/brand";

export const dynamic = "force-dynamic";

export default async function PortalDashboardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await loadPortalContext(token);
  if (!context) return <InvalidPortal />;

  const { lead, state } = context;

  const stepsRemaining = state.checklist.filter((item) => !item.done).length;
  const estimatedMinutes = state.booked
    ? null
    : Math.round((stepsRemaining / 3) * brand.estimatedTimeMinutes);

  let primaryHref = `/p/${token}/overview`;
  let primaryLabel = "Watch Investor Overview";
  if (state.booked || state.reviewRequired) {
    primaryHref = `/p/${token}/complete`;
    primaryLabel = "View Status";
  } else if (state.qualified) {
    primaryHref = `/p/${token}/schedule`;
    primaryLabel = "Schedule Consultation";
  } else if (state.videoCompleted) {
    primaryHref = `/p/${token}/questionnaire`;
    primaryLabel = "Continue Qualification";
  } else if (state.videoStarted) {
    primaryLabel = "Continue Investor Overview";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
          Welcome, {lead.first_name}
        </h1>
        <p className="mt-2 text-lg text-ink-muted">
          Your private investor qualification portal is ready.
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Complete the steps below before scheduling your consultation with {brand.advisorName}.
          This process helps us understand your goals and ensures your consultation is focused on
          the questions that matter most to you.
        </p>
      </div>

      <PortalStatusCard
        statusLabel={state.statusLabel}
        estimatedMinutesRemaining={estimatedMinutes}
      />

      <div className="rounded-xl border border-line bg-white p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-ink-muted">Your Progress</h2>
        <div className="mt-4">
          <StepChecklist items={state.checklist} />
        </div>
      </div>

      <Link
        href={primaryHref}
        className="block w-full rounded-lg bg-brand px-6 py-3.5 text-center text-sm font-semibold text-white transition hover:opacity-90 sm:inline-block sm:w-auto"
      >
        {primaryLabel}
      </Link>
    </div>
  );
}
