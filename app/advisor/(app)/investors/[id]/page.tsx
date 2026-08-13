import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaffUser } from "@/lib/advisor/auth";
import { canAccessLead, isAdmin } from "@/lib/advisor/access";
import { getStore } from "@/lib/store";
import { evaluateFollowUp } from "@/lib/advisor/followUp";
import { deriveNextBestAction } from "@/lib/advisor/nextBestAction";
import { eventLabel, formatDateTime } from "@/lib/advisor/format";
import { resolveClientFromLead } from "@/lib/domain/clients";
import { listOpportunitiesForClient } from "@/lib/domain/opportunities";
import { getAppUrl } from "@/lib/config/env";
import type { BrandRecord, ClientRecord, OpportunityRecord } from "@/types/domain";
import { OwnershipProfileCard } from "@/components/advisor/OwnershipProfileCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientHeaderCard } from "@/components/advisor/investorDetail/ClientHeaderCard";
import { NextBestActionCard } from "@/components/advisor/investorDetail/NextBestActionCard";
import { AdvisorNotesCard } from "@/components/advisor/investorDetail/AdvisorNotesCard";
import { VideoEngagementCard } from "@/components/advisor/investorDetail/VideoEngagementCard";
import { ActivityTimelineCard } from "@/components/advisor/investorDetail/ActivityTimelineCard";
import { QualificationOverviewCard } from "@/components/advisor/investorDetail/QualificationOverviewCard";
import { LocationTerritoryCard } from "@/components/advisor/investorDetail/LocationTerritoryCard";
import { ConsultationsCard } from "@/components/advisor/investorDetail/ConsultationsCard";
import { FddStatusCard } from "@/components/advisor/investorDetail/FddStatusCard";
import { FundingProfileCard } from "@/components/advisor/investorDetail/FundingProfileCard";

export const metadata: Metadata = { title: "Client" };
export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-faint-foreground">{label}</p>
      <div className="mt-0.5 text-sm text-foreground">{value ?? "—"}</div>
    </div>
  );
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
    fddAudit,
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
      store.listFddAudit(lead.id),
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

  return (
    <div className="space-y-5">
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
        lastActivityLabel={lastActivityLabel}
      />

      {/* Primary action area: Next Best Action carries the same "why" that
          used to live in a full-width follow-up banner — never said twice. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <NextBestActionCard action={nextBestAction} email={lead.email} />
        </div>
        <div className="lg:col-span-8">
          <AdvisorNotesCard
            investorId={lead.id}
            notes={notes}
            staffNameById={staffNameById}
            currentStaffId={user.id}
          />
        </div>
      </div>

      {/* Deal intelligence: weighted, not four equally-sized boxes. */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-12">
        <div className="xl:col-span-3">
          <VideoEngagementCard video={video} />
        </div>
        <div className="xl:col-span-4">
          <ActivityTimelineCard events={events} />
        </div>
        <div className="xl:col-span-3">
          <QualificationOverviewCard
            lead={lead}
            questionnaire={questionnaire}
            hasFullProfile={Boolean(latestSubmission)}
          />
        </div>
        <div className="xl:col-span-2">
          <LocationTerritoryCard lead={lead} questionnaire={questionnaire} isAdminUser={isAdminUser} />
        </div>
      </div>

      {/* Secondary deal information: compact, expandable, not competing for
          attention with the sections above. */}
      <div className="grid gap-5 lg:grid-cols-3">
        <ConsultationsCard lead={lead} appointments={appointments} staffById={staffById} portalUrl={portalUrl} />
        <FddStatusCard investorId={lead.id} lead={lead} fddAudit={fddAudit} />
        <FundingProfileCard questionnaire={questionnaire} />
      </div>

      {/* Full questionnaire responses — kept for the record beneath the summary cards above. */}
      {latestSubmission && (
        <Card id="questionnaire-responses" className="scroll-mt-6 rounded-2xl">
          <CardHeader>
            <CardTitle>Questionnaire Responses</CardTitle>
            <p className="text-sm text-muted-foreground">
              Submitted {formatDateTime(latestSubmission.submitted_at)} · Version{" "}
              {latestSubmission.questionnaire_version}
            </p>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              {latestSubmission.answers.map((answer) => (
                <div key={answer.id}>
                  <dt className="text-sm font-medium text-secondary-foreground">
                    {answer.question_text}
                  </dt>
                  <dd className="mt-0.5 text-sm text-foreground">{answer.answer_display_value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Attribution — first/last touch marketing data, kept for the record. */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Attribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-faint-foreground">
              First Touch
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <Field label="Source" value={lead.source} />
              <Field label="Campaign" value={lead.campaign} />
              <Field label="Ad Set" value={lead.ad_set} />
              <Field label="Ad" value={lead.ad} />
              <Field label="UTM Source" value={lead.first_utm_source} />
              <Field label="UTM Campaign" value={lead.first_utm_campaign} />
              <Field label="UTM Medium" value={lead.first_utm_medium} />
              <Field label="UTM Content" value={lead.first_utm_content} />
              <Field label="Facebook Lead ID" value={lead.facebook_lead_id} />
              <Field label="Facebook Click ID" value={lead.first_fbclid} />
              <Field label="Google Click ID" value={lead.first_gclid} />
              <Field label="Landing Page" value={lead.first_landing_page} />
              <Field label="Referrer" value={lead.first_referrer} />
              <Field label="Portal First Opened" value={formatDateTime(lead.portal_first_opened_at)} />
            </div>
          </div>

          {(lead.facebook_campaign_id || lead.facebook_adset_id || lead.facebook_ad_id || lead.facebook_form_id) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-faint-foreground">
                Facebook Lead Ads
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <Field label="Campaign ID" value={lead.facebook_campaign_id} />
                <Field label="Ad Set ID" value={lead.facebook_adset_id} />
                <Field label="Ad ID" value={lead.facebook_ad_id} />
                <Field label="Form ID" value={lead.facebook_form_id} />
              </div>
            </div>
          )}

          {lead.last_touch_at && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-faint-foreground">
                Last Touch
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <Field label="Source" value={lead.last_utm_source} />
                <Field label="Campaign" value={lead.last_utm_campaign} />
                <Field label="Referrer" value={lead.last_referrer} />
                <Field label="Last Touch At" value={formatDateTime(lead.last_touch_at)} />
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-faint-foreground">
              Conversion
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {lead.qualification_result === "qualified" && <Badge variant="success">Qualified Lead</Badge>}
              {lead.qualification_result === "review_required" && <Badge variant="outline">Review Required</Badge>}
              {lead.booked_at && <Badge variant="primary">Booked Consultation</Badge>}
              {!lead.qualification_result && !lead.booked_at && (
                <span className="text-sm text-muted-foreground">No conversion yet</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What the investor says they want from ownership (self-reported,
          not a qualification signal). */}
      <OwnershipProfileCard profile={ownershipProfile} />
    </div>
  );
}
