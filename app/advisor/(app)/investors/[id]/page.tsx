import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaffUser } from "@/lib/advisor/auth";
import { canAccessLead, isAdmin } from "@/lib/advisor/access";
import { getStore } from "@/lib/store";
import { evaluateFollowUp } from "@/lib/advisor/followUp";
import { deriveNextBestAction } from "@/lib/advisor/nextBestAction";
import { eventLabel, formatDate } from "@/lib/advisor/format";
import { effectiveFddStatus } from "@/lib/fdd/status";
import { resolveClientFromLead } from "@/lib/domain/clients";
import { listOpportunitiesForClient } from "@/lib/domain/opportunities";
import { getAppUrl } from "@/lib/config/env";
import type { MilestoneTone } from "@/lib/advisor/milestones";
import type { BrandRecord, ClientRecord, OpportunityRecord } from "@/types/domain";
import { OwnershipProfileCard } from "@/components/advisor/OwnershipProfileCard";
import { ClientHeaderCard } from "@/components/advisor/investorDetail/ClientHeaderCard";
import { NextBestActionCard } from "@/components/advisor/investorDetail/NextBestActionCard";
import { ClientProgressCard } from "@/components/advisor/investorDetail/ClientProgressCard";
import { ProcessMilestonesCard } from "@/components/advisor/investorDetail/ProcessMilestonesCard";
import { VideoEngagementCard } from "@/components/advisor/investorDetail/VideoEngagementCard";
import { LeadSourceCard } from "@/components/advisor/investorDetail/LeadSourceCard";
import { ActivityTimelineCard } from "@/components/advisor/investorDetail/ActivityTimelineCard";
import { AdvisorNotesCard } from "@/components/advisor/investorDetail/AdvisorNotesCard";
import { QualificationOverviewCard } from "@/components/advisor/investorDetail/QualificationOverviewCard";
import { QuestionnaireResponsesCard } from "@/components/advisor/investorDetail/QuestionnaireResponsesCard";
import { AttributionCard } from "@/components/advisor/investorDetail/AttributionCard";

export const metadata: Metadata = { title: "Client" };
export const dynamic = "force-dynamic";

function withinHours(iso: string | null | undefined, hours: number): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() <= hours * 3_600_000;
}

export default async function InvestorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireStaffUser();
  const { id } = await params;
  const isAdminUser = isAdmin(user);

  const store = getStore();
  const lead = await store.getLeadById(id);
  // 404 for both missing and unauthorized — never confirm existence.
  if (!lead || !canAccessLead(user, lead)) notFound();

  const [
    questionnaire,
    submissions,
    video,
    appointments,
    notes,
    events,
    staff,
    ownershipProfile,
  ] =
    await Promise.all([
      store.getQuestionnaire(lead.id),
      store.getSubmissionsForLead(lead.id),
      store.getVideoProgress(lead.id),
      store.getAppointmentsForLead(lead.id),
      store.getNotesForLead(lead.id),
      store.getEventsForLead(lead.id),
      store.listStaffUsers(),
      store.getOwnershipProfile(lead.id),
    ]);

  // Platform domain: the client record and ALL of their opportunities (a
  // client may pursue multiple brands). Failure falls back to lead-only view.
  let client: ClientRecord | null = null;
  let clientOpportunities: OpportunityRecord[] = [];
  let brandById = new Map<string, BrandRecord>();
  try {
    client = await resolveClientFromLead(lead);
    if (client) {
      clientOpportunities = await listOpportunitiesForClient(client.id);
      const brands = await store.listBrands();
      brandById = new Map(brands.map((b) => [b.id, b]));
    }
  } catch (error) {
    console.error("[advisor] client/opportunity resolution failed:", error);
  }
  const primaryOpportunity =
    clientOpportunities.find((o) => o.id === lead.primary_opportunity_id) ??
    clientOpportunities.find((o) => o.source_lead_id === lead.id) ??
    null;
  const primaryBrand = primaryOpportunity ? brandById.get(primaryOpportunity.brand_id) : null;

  const staffById = new Map(staff.map((s) => [s.id, s]));
  const staffNameById = Object.fromEntries(
    staff.map((s) => [s.id, `${s.first_name} ${s.last_name}`]),
  );
  const advisor = lead.assigned_advisor_id ? staffById.get(lead.assigned_advisor_id) : null;
  const followUp = evaluateFollowUp({ lead, appointments, video });
  const nextBestAction = deriveNextBestAction(
    lead,
    questionnaire,
    video,
    appointments,
    events,
    notes.length,
  );
  const latestSubmission = submissions[0] ?? null;
  const portalUrl = `${getAppUrl()}/p/${lead.portal_token}`;
  const lastActivityLabel = events[0] ? eventLabel(events[0].event_name) : null;
  // Same field the header's "Last activity" reads — no separate hotness
  // score, just a presentation threshold over real recency data.
  const isHotLead = withinHours(lead.last_activity_at ?? lead.created_at, 24);

  // Consultation summary for the Client Progress rail.
  const activeAppointment = appointments.find(
    (a) => a.status === "SCHEDULED" || a.status === "RESCHEDULED",
  );
  const completedAppointment = appointments.some((a) => a.status === "COMPLETED");
  const consultation: { label: string; tone: MilestoneTone; date: string | null } = activeAppointment
    ? {
        label: activeAppointment.status === "RESCHEDULED" ? "Rescheduled" : "Scheduled",
        tone: "amber",
        date: formatDate(activeAppointment.scheduled_start),
      }
    : completedAppointment
      ? { label: "Completed", tone: "green", date: null }
      : lead.booked_at
        ? { label: "Scheduled", tone: "amber", date: formatDate(lead.appointment_start_at) }
        : { label: "Not booked", tone: "neutral", date: null };

  const fddStatus = effectiveFddStatus(lead);
  const fddInFlight = fddStatus !== "not_requested" && fddStatus !== "error_manual_review";

  return (
    <div className="space-y-2.5">
      <ClientHeaderCard
        lead={lead}
        advisor={advisor ?? null}
        brandName={
          primaryBrand?.name ??
          (clientOpportunities.length > 1
            ? clientOpportunities.map((o) => brandById.get(o.brand_id)?.name ?? "Unknown brand").join(", ")
            : null)
        }
        isAdminUser={isAdminUser}
        staff={staff}
        portalUrl={portalUrl}
        needsFollowUp={followUp.needed}
        isHotLead={isHotLead}
        lastActivityLabel={lastActivityLabel}
      />

      {/* Row A — the actionable pair: what to do next, where the client is. */}
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(330px,1fr))]">
        <NextBestActionCard action={nextBestAction} email={lead.email} portalUrl={portalUrl} />
        <ClientProgressCard
          investorId={lead.id}
          email={lead.email}
          portalUrl={portalUrl}
          consultation={consultation}
          fddStatus={fddStatus}
          fddInFlight={fddInFlight}
          questionnaire={questionnaire}
          questionnaireCompleted={Boolean(lead.questionnaire_completed_at ?? questionnaire)}
          questionnaireStarted={Boolean(lead.questionnaire_started_at)}
        />
      </div>

      {/* Row B — milestones, engagement, source. */}
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(290px,1fr))]">
        <ProcessMilestonesCard investorId={lead.id} milestones={lead.process_milestones ?? null} />
        <VideoEngagementCard video={video} />
        <LeadSourceCard lead={lead} questionnaire={questionnaire} />
      </div>

      {/* Row C — the working surfaces. */}
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(370px,1fr))]">
        <ActivityTimelineCard events={events} />
        <AdvisorNotesCard
          investorId={lead.id}
          notes={notes}
          staffNameById={staffNameById}
          currentStaffId={user.id}
        />
      </div>

      {/* Static facts, next to the questionnaire they came from. */}
      <QualificationOverviewCard lead={lead} questionnaire={questionnaire} />

      {latestSubmission && (
        <QuestionnaireResponsesCard questionnaire={questionnaire} submission={latestSubmission} />
      )}

      <AttributionCard lead={lead} />

      {/* What the investor says they want from ownership (self-reported,
          not a qualification signal). */}
      <OwnershipProfileCard profile={ownershipProfile} />
    </div>
  );
}
