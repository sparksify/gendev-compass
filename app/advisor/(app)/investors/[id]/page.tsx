import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles, User } from "lucide-react";
import { requireStaffUser } from "@/lib/advisor/auth";
import { canAccessLead, isAdmin } from "@/lib/advisor/access";
import { getStore } from "@/lib/store";
import { evaluateFollowUp } from "@/lib/advisor/followUp";
import { deriveNextBestAction } from "@/lib/advisor/nextBestAction";
import { formatDate } from "@/lib/advisor/format";
import { labelForValue } from "@/lib/advisor/questionnaireCatalog";
import { compactMoney } from "@/lib/advisor/money";
import {
  intentRead,
  qualificationFactors,
  stageAge,
} from "@/lib/advisor/clientIntelligence";
import { effectiveFddStatus, FDD_STATUS_LABELS } from "@/lib/fdd/status";
import { getFddWaitingPeriodDays } from "@/lib/config/fdd";
import { fetchGhlContactTags } from "@/lib/ghl/contactTags";
import { resolveClientFromLead } from "@/lib/domain/clients";
import { listOpportunitiesForClient } from "@/lib/domain/opportunities";
import { getAppUrl } from "@/lib/config/env";
import { pipelineProgress } from "@/lib/advisor/pipelineProgress";
import type { BrandRecord, ClientRecord, OpportunityRecord } from "@/types/domain";
import {
  AccentNote,
  LeaderRow,
  Panel,
  Pill,
  V3Page,
} from "@/components/advisor/v3";
import { ACCENT_BUTTON, SECONDARY_BUTTON, TERTIARY_BUTTON } from "@/components/advisor/controls";
import { ClientHeaderBand } from "@/components/advisor/investorDetail/ClientHeaderBand";
import { PipelineStepper } from "@/components/advisor/investorDetail/PipelineStepper";
import { VideoEngagementCard } from "@/components/advisor/investorDetail/VideoEngagementCard";
import { ClientIntelligenceCard } from "@/components/advisor/investorDetail/ClientIntelligenceCard";
import { ActivityRail } from "@/components/advisor/investorDetail/ActivityRail";
import {
  NotesRail,
  type UpcomingActivity,
} from "@/components/advisor/investorDetail/NotesRail";
import { AdvisorAssignmentControl } from "@/components/advisor/investorDetail/AdvisorAssignmentControl";
import { TerritoriesWantedControl } from "@/components/advisor/investorDetail/TerritoriesWantedControl";
import { CopyPortalButton } from "@/components/advisor/investorDetail/CopyPortalButton";
import { ProcessMilestonesCard } from "@/components/advisor/investorDetail/ProcessMilestonesCard";
import { QuestionnaireResponsesCard } from "@/components/advisor/investorDetail/QuestionnaireResponsesCard";
import { AttributionCard } from "@/components/advisor/investorDetail/AttributionCard";
import { TagsCard } from "@/components/advisor/investorDetail/TagsCard";
import { OwnershipProfileCard } from "@/components/advisor/OwnershipProfileCard";

export const metadata: Metadata = { title: "Client" };
export const dynamic = "force-dynamic";

function initialsOf(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?";
}

/**
 * The client detail page (v3 handoff): a green identity band over the 12-stage
 * pipeline strip, then a two-column body — engagement, milestones and activity
 * on the left; the next best action, the intelligence read, qualification,
 * notes, the record and the HighLevel tags on the right — closed by the full
 * questionnaire and attribution record.
 */
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

  const [questionnaire, submissions, video, appointments, notes, events, staff, ownershipProfile] =
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

  // HighLevel owns the contact's tags; the lookup degrades to a rendered
  // "unavailable" state rather than failing the page.
  const ghlTags = await fetchGhlContactTags(lead);

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
  const stage = primaryOpportunity?.stage ?? lead.current_stage;

  const staffNameById = Object.fromEntries(
    staff.map((s) => [s.id, `${s.first_name} ${s.last_name}`]),
  );
  const followUp = evaluateFollowUp({ lead, appointments, video });
  const action = deriveNextBestAction(
    lead,
    questionnaire,
    video,
    appointments,
    events,
    notes.length,
  );
  const latestSubmission = submissions[0] ?? null;
  const portalUrl = `${getAppUrl()}/p/${lead.portal_token}`;
  const fddStatus = effectiveFddStatus(lead);

  const name = `${lead.first_name} ${lead.last_name}`;
  const percent = video ? Math.min(100, Math.max(0, Math.round(video.highest_percent_watched))) : null;
  const capital = compactMoney(
    labelForValue(questionnaire?.liquid_capital ?? lead.initial_liquid_capital),
  );
  const netWorth = compactMoney(
    labelForValue(questionnaire?.net_worth ?? lead.initial_net_worth),
  );

  const reminderHref = action.reminder
    ? `mailto:${lead.email}?subject=${encodeURIComponent(action.reminder.subject)}&body=${encodeURIComponent(action.reminder.body)}`
    : `mailto:${lead.email}`;

  // Where this client sits on the 12-stage pipeline, and how long they have
  // been sitting there.
  const progress = pipelineProgress(stage, events, lead.created_at);
  const intent = intentRead(lead.qualification_score, events);
  const factors = qualificationFactors(questionnaire);
  const age = stageAge(progress.daysInStage);

  // The next scheduled touch, attached under the pinned note.
  const activeAppointment = appointments.find(
    (a) => a.status === "SCHEDULED" || a.status === "RESCHEDULED",
  );
  const upcoming: UpcomingActivity | null = activeAppointment
    ? {
        id: activeAppointment.id,
        type: "Consultation",
        meta: [
          activeAppointment.scheduled_start
            ? formatDate(activeAppointment.scheduled_start)
            : "Unscheduled",
          activeAppointment.advisor_id
            ? (staffNameById[activeAppointment.advisor_id] ?? null)
            : null,
          name,
        ]
          .filter(Boolean)
          .join(" · "),
      }
    : null;

  // The band's faint second line: only the facts we actually hold.
  const bandMeta: Array<{ icon: "location" | "source" | "advisor" | "joined"; label: string }> = [];
  const place = [questionnaire?.city, lead.state].filter(Boolean).join(", ");
  if (place) bandMeta.push({ icon: "location", label: place });
  if (lead.source) bandMeta.push({ icon: "source", label: `${lead.source} Lead` });
  if (lead.assigned_advisor_id && staffNameById[lead.assigned_advisor_id]) {
    bandMeta.push({ icon: "advisor", label: `Advisor: ${staffNameById[lead.assigned_advisor_id]}` });
  }
  bandMeta.push({ icon: "joined", label: `Joined ${formatDate(lead.created_at)}` });
  if (primaryBrand?.name) bandMeta.push({ icon: "source", label: primaryBrand.name });

  return (
    <V3Page>
      {/* Breadcrumb + the page's own utility. */}
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Link href="/advisor" className="hover:text-foreground">
            Dashboard
          </Link>
          <span aria-hidden>›</span>
          <Link href="/advisor/investors" className="hover:text-foreground">
            Clients
          </Link>
          <span aria-hidden>›</span>
          <span className="font-bold text-foreground">{name}</span>
        </p>
        <Link href="#notes" className={SECONDARY_BUTTON}>
          ＋ Add Note
        </Link>
      </div>

      <ClientHeaderBand
        name={name}
        initials={initialsOf(lead.first_name, lead.last_name)}
        email={lead.email}
        phone={lead.phone}
        meta={bandMeta}
        followUp={followUp.needed ? followUp.reasons.join(" ") : null}
        tabs={[
          { href: "#profile", label: "Profile" },
          { href: "#notes", label: "Notes", count: notes.length },
          { href: "#activity", label: "Activity", count: events.length },
          { href: "#questionnaire-responses", label: "Questionnaire" },
          { href: "#milestones", label: "Milestones" },
          { href: "#attribution", label: "Attribution" },
        ]}
        actions={
          isAdminUser ? (
            <span className="inline-flex items-center gap-[7px] rounded-[9px] border border-white/55 px-[13px] py-[7px]">
              <User className="size-3 text-white" strokeWidth={2} />
              <AdvisorAssignmentControl
                investorId={lead.id}
                advisors={staff.map((s) => ({
                  id: s.id,
                  name: `${s.first_name} ${s.last_name}`,
                }))}
                currentAdvisorId={lead.assigned_advisor_id}
                tone="onDark"
              />
            </span>
          ) : undefined
        }
      />

      <PipelineStepper investorId={lead.id} progress={progress} />

      <div id="profile" className="grid items-start gap-3.5 scroll-mt-4 xl:grid-cols-[1.55fr_1fr] [&>*]:min-w-0">
        {/* Left column: what they did, and what has to happen next. */}
        <div className="flex flex-col gap-3.5">
          <VideoEngagementCard video={video} />

          <ProcessMilestonesCard
            investorId={lead.id}
            milestones={lead.process_milestones ?? null}
            questionnaireSubmittedAt={latestSubmission?.submitted_at ?? null}
            fdd={{
              status: fddStatus,
              receivedAt: lead.fdd_received_at,
              eligibleAt: lead.fdd_eligible_at,
              waitingPeriodDays: getFddWaitingPeriodDays(),
            }}
          />

          <ActivityRail events={events} />
        </div>

        {/* Right rail: the read on this client, and the record's facts. */}
        <div className="flex flex-col gap-3.5">
          <AccentNote className="bg-[linear-gradient(180deg,#fffdf5,#fff9e8)] px-[18px] py-[15px]">
            <div className="flex items-center justify-between gap-2.5">
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-accent-strong">
                Next Best Action
              </p>
              <Sparkles className="size-3.5 text-[#c99e1a]" strokeWidth={2} />
            </div>
            <p className="mt-2 text-[15.5px] font-extrabold leading-[1.4] text-foreground">
              {action.title}
            </p>
            <p className="mt-[5px] text-[12.5px] leading-[1.55] text-muted-foreground">
              {action.description}
            </p>
            {action.whyItMatters && (
              <p className="mt-[5px] text-[12.5px] leading-[1.55] text-muted-foreground">
                {action.whyItMatters}
              </p>
            )}
            {action.reminder && (
              <div className="mt-[11px] flex items-center gap-3">
                <a href={reminderHref} className={ACCENT_BUTTON}>
                  {action.ctaLabel}
                </a>
                <Link href="#milestones" className={TERTIARY_BUTTON}>
                  Not now
                </Link>
              </div>
            )}
          </AccentNote>

          <ClientIntelligenceCard
            intent={intent}
            score={lead.qualification_score}
            factors={factors}
            videoPercent={percent}
            daysInStage={progress.daysInStage}
            age={age}
          />

          <Panel>
            <p className="text-[15px] font-bold text-foreground">Qualification</p>
            <div className="mt-[3px] flex flex-col text-[13px]">
              <LeaderRow label="Liquid capital" value={<span className="tabular">{capital}</span>} />
              <LeaderRow label="Net worth" value={<span className="tabular">{netWorth}</span>} />
              <LeaderRow
                label="Timeline"
                value={labelForValue(questionnaire?.investment_timeline)}
              />
              <LeaderRow label="Funding" value={labelForValue(questionnaire?.financing_need)} />
              <LeaderRow
                label="Result"
                value={
                  lead.qualification_result === "qualified" ? (
                    <Pill tone="success">Qualified</Pill>
                  ) : lead.qualification_result === "review_required" ? (
                    <Pill tone="warning">Review required</Pill>
                  ) : (
                    "—"
                  )
                }
              />
            </div>
          </Panel>

          <NotesRail
            investorId={lead.id}
            notes={notes}
            staffNameById={staffNameById}
            upcoming={upcoming}
          />

          {/* The record's editable facts — assignment, territories, FDD and
              the prospect's portal link. Stage lives in the strip above. */}
          <Panel>
            <p className="text-[15px] font-bold text-foreground">Record</p>
            <div className="mt-[3px] flex flex-col text-[13px]">
              <LeaderRow
                label="Advisor"
                value={
                  isAdminUser ? (
                    <AdvisorAssignmentControl
                      investorId={lead.id}
                      advisors={staff.map((s) => ({
                        id: s.id,
                        name: `${s.first_name} ${s.last_name}`,
                      }))}
                      currentAdvisorId={lead.assigned_advisor_id}
                    />
                  ) : lead.assigned_advisor_id ? (
                    (staffNameById[lead.assigned_advisor_id] ?? "—")
                  ) : (
                    "Unassigned"
                  )
                }
              />
              <LeaderRow
                label="Territories wanted"
                value={
                  <TerritoriesWantedControl
                    investorId={lead.id}
                    value={lead.territories_wanted ?? null}
                  />
                }
              />
              <LeaderRow label="FDD" value={FDD_STATUS_LABELS[fddStatus]} />
              <LeaderRow label="Portal link" value={<CopyPortalButton portalUrl={portalUrl} />} />
            </div>
          </Panel>

          <TagsCard tags={ghlTags} />
        </div>
      </div>

      {/* The full record: everything the summary above doesn't carry. */}
      {latestSubmission && (
        <QuestionnaireResponsesCard questionnaire={questionnaire} submission={latestSubmission} />
      )}
      <OwnershipProfileCard profile={ownershipProfile} />
      <AttributionCard lead={lead} />
    </V3Page>
  );
}
