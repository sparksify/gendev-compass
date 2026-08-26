import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffUser } from "@/lib/advisor/auth";
import { canAccessLead, isAdmin } from "@/lib/advisor/access";
import { getStore } from "@/lib/store";
import { evaluateFollowUp } from "@/lib/advisor/followUp";
import { deriveNextBestAction } from "@/lib/advisor/nextBestAction";
import { formatDate, formatRelative } from "@/lib/advisor/format";
import { labelForValue } from "@/lib/advisor/questionnaireCatalog";
import { compactMoney } from "@/lib/advisor/money";
import { effectiveFddStatus } from "@/lib/fdd/status";
import { resolveClientFromLead } from "@/lib/domain/clients";
import { listOpportunitiesForClient } from "@/lib/domain/opportunities";
import { getAppUrl } from "@/lib/config/env";
import { cn } from "@/lib/utils";
import {
  discoveryStageIdFor,
  DISCOVERY_STAGES,
  SIGNAL,
  type DiscoveryStageId,
} from "@/lib/advisor/discoveryStages";
import type { BrandRecord, ClientRecord, OpportunityRecord } from "@/types/domain";
import { PageBody, PageHeader, SectionRule } from "@/components/advisor/PageHeader";
import { INK_BUTTON, SECONDARY_BUTTON } from "@/components/advisor/controls";
import { DiscoveryStageStrip } from "@/components/advisor/investorDetail/DiscoveryStageStrip";
import { VideoEngagementHero } from "@/components/advisor/investorDetail/VideoEngagementHero";
import { ActivityRail } from "@/components/advisor/investorDetail/ActivityRail";
import { NotesRail } from "@/components/advisor/investorDetail/NotesRail";
import { AdvisorAssignmentControl } from "@/components/advisor/investorDetail/AdvisorAssignmentControl";
import { StageStatusControl } from "@/components/advisor/investorDetail/StageStatusControl";
import { TerritoriesWantedControl } from "@/components/advisor/investorDetail/TerritoriesWantedControl";
import { CopyPortalButton } from "@/components/advisor/investorDetail/CopyPortalButton";
import { ProcessMilestonesCard } from "@/components/advisor/investorDetail/ProcessMilestonesCard";
import { QuestionnaireResponsesCard } from "@/components/advisor/investorDetail/QuestionnaireResponsesCard";
import { AttributionCard } from "@/components/advisor/investorDetail/AttributionCard";
import { OwnershipProfileCard } from "@/components/advisor/OwnershipProfileCard";
import { watchColor } from "@/components/advisor/VideoWatchedBar";

export const metadata: Metadata = { title: "Client" };
export const dynamic = "force-dynamic";

function KeyStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-faint-foreground">
        {label}
      </p>
      <p
        className={cn(
          "tabular mt-1 font-extrabold tracking-[-0.03em]",
          value === "—" ? "text-[19.5px] leading-[1.4] text-ghost-foreground" : "text-[26px] leading-[1.2]",
        )}
        style={value === "—" ? undefined : { color }}
      >
        {value}
      </p>
    </div>
  );
}

/** A dotted-leader fact row — the qualification block's anatomy. */
function LeaderRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="flex items-center justify-between gap-4 border-b border-dotted border-border-leader py-2 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-bold text-foreground">{value}</span>
    </span>
  );
}

/**
 * The client detail page (handoff mock 5c): who they are and the three
 * numbers that matter, the 5-stage discovery strip, the video-engagement
 * hero, and a right rail carrying the next best action, the qualification
 * facts and the notes.
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

  // What each discovery stage says about this client right now — dates for
  // what's done, a live read for where they are.
  const activeStageId = discoveryStageIdFor(stage);
  const activeAppointment = appointments.find(
    (a) => a.status === "SCHEDULED" || a.status === "RESCHEDULED",
  );
  const stageContext: Partial<Record<DiscoveryStageId, string>> = {
    1: lead.portal_first_opened_at ? formatDate(lead.portal_first_opened_at) : undefined,
    2: lead.questionnaire_completed_at
      ? `questionnaire ${formatDate(lead.questionnaire_completed_at)}`
      : percent !== null
        ? `video ${percent}%`
        : undefined,
    3: lead.fdd_sent_at ? `FDD ${fddStatus.replaceAll("_", " ")}` : undefined,
    4: activeAppointment?.scheduled_start
      ? `booked ${formatDate(activeAppointment.scheduled_start)}`
      : undefined,
    5: lead.current_stage === "CLOSED_INVESTED" ? "committed" : undefined,
  };
  if (activeStageId === 2 && activeAppointment) {
    stageContext[2] = `consultation ${formatDate(activeAppointment.scheduled_start)}`;
  }

  const meta = [
    lead.email,
    lead.phone,
    lead.state,
    lead.source ? `${lead.source} lead` : null,
    `joined ${formatRelative(lead.created_at)}`,
    primaryBrand?.name ?? null,
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        breadcrumb={{ href: "/advisor/investors", label: "Clients", current: name }}
        actions={
          <>
            <Link href="#notes" className={SECONDARY_BUTTON}>
              Add note
            </Link>
            <a href={reminderHref} className={INK_BUTTON}>
              Send reminder
            </a>
          </>
        }
      />

      <PageBody className="flex flex-col gap-[26px]">
        {/* Identity + the three numbers that matter */}
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
          <div className="min-w-[320px] flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[28px] font-extrabold tracking-[-0.03em] text-foreground">{name}</h2>
              {followUp.needed && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-bold tracking-[0.08em]"
                  style={{ color: SIGNAL.alert, backgroundColor: SIGNAL.alertTint }}
                  title={followUp.reasons.join(" ")}
                >
                  <span
                    aria-hidden
                    className="size-[5px] rounded-full"
                    style={{ backgroundColor: SIGNAL.alert }}
                  />
                  FOLLOW-UP DUE
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[14px] text-muted-foreground">{meta.join(" · ")}</p>
          </div>
          <div className="flex shrink-0 gap-x-9 gap-y-4 text-right">
            <KeyStat
              label="Video watched"
              value={percent === null ? "—" : `${percent}%`}
              color={
                percent === null
                  ? SIGNAL.neutral
                  : watchColor(percent, video?.completed ?? false)
              }
            />
            <KeyStat label="Liquid capital" value={capital} color={SIGNAL.success} />
            <KeyStat
              label="Score"
              value={lead.qualification_score === null ? "—" : String(lead.qualification_score)}
              color={DISCOVERY_STAGES[2].color}
            />
          </div>
        </div>

        {/* Discovery stage strip — clicking a stage sets it. */}
        <DiscoveryStageStrip investorId={lead.id} currentStage={stage} context={stageContext} />

        <div className="grid gap-10 xl:grid-cols-[1.5fr_1fr] xl:gap-11 [&>*]:min-w-0">
          <div className="flex flex-col gap-6">
            <VideoEngagementHero video={video} />

            <div>
              <SectionRule label="Activity" className="mb-1.5" />
              <ActivityRail events={events} />
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {/* Next best action */}
            <div className="rounded-card border border-[#fde68a] bg-[linear-gradient(180deg,#fffdf5,#fffaeb)] px-[18px] py-4">
              <p
                className="text-[11px] font-bold uppercase tracking-[0.15em]"
                style={{ color: SIGNAL.warning }}
              >
                Next best action
              </p>
              <p className="mt-2 text-[15.5px] leading-[1.45] font-bold text-foreground">{action.title}</p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                {action.description}
              </p>
              {action.whyItMatters && (
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                  {action.whyItMatters}
                </p>
              )}
              {action.reminder && (
                <a href={reminderHref} className={`${INK_BUTTON} mt-3`}>
                  {action.ctaLabel}
                </a>
              )}
            </div>

            {/* Qualification */}
            <div>
              <SectionRule label="Qualification" className="mb-1" />
              <div className="flex flex-col text-[14px]">
                <LeaderRow label="Liquid capital" value={<span className="tabular">{capital}</span>} />
                <LeaderRow label="Net worth" value={<span className="tabular">{netWorth}</span>} />
                <LeaderRow
                  label="Timeline"
                  value={labelForValue(questionnaire?.investment_timeline)}
                />
                <LeaderRow label="Funding" value={labelForValue(questionnaire?.financing_need)} />
                <LeaderRow
                  label="Score"
                  value={
                    lead.qualification_score === null ? (
                      "—"
                    ) : (
                      <span className="tabular" style={{ color: DISCOVERY_STAGES[2].color }}>
                        {lead.qualification_score} / 100
                        {lead.qualification_result
                          ? ` · ${lead.qualification_result === "qualified" ? "Qualified" : "Review required"}`
                          : ""}
                      </span>
                    )
                  }
                />
              </div>
            </div>

            <NotesRail investorId={lead.id} notes={notes} staffNameById={staffNameById} />

            {/* The record's editable facts — assignment, territories, the
                granular pipeline stage, and the prospect's portal link. */}
            <div>
              <SectionRule label="Record" className="mb-1" />
              <div className="flex flex-col text-[14px]">
                <LeaderRow
                  label="Pipeline stage"
                  value={<StageStatusControl investorId={lead.id} currentStage={lead.current_stage} />}
                />
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
                <LeaderRow label="Portal link" value={<CopyPortalButton portalUrl={portalUrl} />} />
              </div>
            </div>
          </div>
        </div>

        {/* The full record: everything the summary above doesn't carry. */}
        <div className="flex flex-col gap-4 border-t border-border pt-6">
          <ProcessMilestonesCard investorId={lead.id} milestones={lead.process_milestones ?? null} />
          {latestSubmission && (
            <QuestionnaireResponsesCard questionnaire={questionnaire} submission={latestSubmission} />
          )}
          <OwnershipProfileCard profile={ownershipProfile} />
          <AttributionCard lead={lead} />
        </div>
      </PageBody>
    </>
  );
}
