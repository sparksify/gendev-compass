import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaffUser } from "@/lib/advisor/auth";
import { canAccessLead, isAdmin } from "@/lib/advisor/access";
import { getStore } from "@/lib/store";
import { evaluateFollowUp } from "@/lib/advisor/followUp";
import { suggestNextAction } from "@/lib/advisor/nextAction";
import { labelForValue } from "@/lib/advisor/questionnaireCatalog";
import {
  eventLabel,
  eventSourceLabel,
  formatDateTime,
  formatRelative,
  formatWatchTime,
} from "@/lib/advisor/format";
import { effectiveFddStatus, FDD_STATUS_LABELS } from "@/lib/fdd/status";
import { resolveClientFromLead } from "@/lib/domain/clients";
import { listOpportunitiesForClient } from "@/lib/domain/opportunities";
import { getAppUrl } from "@/lib/config/env";
import type { BrandRecord, ClientRecord, OpportunityRecord } from "@/types/domain";
import { StageBadge } from "@/components/advisor/StageBadge";
import { StageSelect } from "@/components/advisor/StageSelect";
import { AssignAdvisorSelect } from "@/components/advisor/AssignAdvisorSelect";
import { NoteForm } from "@/components/advisor/NoteForm";
import { GhlTagsInline } from "@/components/advisor/GhlTagsInline";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  const store = getStore();
  const lead = await store.getLeadById(id);
  // 404 for both missing and unauthorized — never confirm existence.
  if (!lead || !canAccessLead(user, lead)) notFound();

  const [questionnaire, submissions, video, appointments, fddAudit, notes, events, staff] =
    await Promise.all([
      store.getQuestionnaire(lead.id),
      store.getSubmissionsForLead(lead.id),
      store.getVideoProgress(lead.id),
      store.getAppointmentsForLead(lead.id),
      store.listFddAudit(lead.id),
      store.getNotesForLead(lead.id),
      store.getEventsForLead(lead.id),
      store.listStaffUsers(),
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
  const advisor = lead.assigned_advisor_id ? staffById.get(lead.assigned_advisor_id) : null;
  const followUp = evaluateFollowUp({ lead, appointments, video });
  const nextAction = suggestNextAction(lead, appointments, video);
  const fddStatus = effectiveFddStatus(lead);
  const activeAppointment = appointments.find(
    (a) => a.status === "SCHEDULED" || a.status === "RESCHEDULED",
  );
  const latestSubmission = submissions[0] ?? null;
  const portalUrl = `${getAppUrl()}/p/${lead.portal_token}`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-2xl font-semibold text-foreground">
                  {lead.first_name} {lead.last_name}
                </h1>
                <StageBadge stage={lead.current_stage} />
                {followUp.needed && (
                  <Badge className="bg-[#fef3c7] text-[#92400e]">Needs follow-up</Badge>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-secondary-foreground">
                <a href={`mailto:${lead.email}`} className="hover:text-primary">
                  {lead.email}
                </a>
                {lead.phone && (
                  <a href={`tel:${lead.phone}`} className="hover:text-primary">
                    {lead.phone}
                  </a>
                )}
                {lead.state && <span>{lead.state}</span>}
                <span className="text-muted-foreground">
                  Source: {lead.source ?? "—"}
                  {lead.campaign ? ` / ${lead.campaign}` : ""}
                </span>
              </div>
              <div className="mt-2">
                <GhlTagsInline investorId={lead.id} />
              </div>
              {followUp.needed && (
                <ul className="mt-2 space-y-0.5 text-sm text-[#92400e]">
                  {followUp.reasons.map((reason) => (
                    <li key={reason}>• {reason}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <Field label="Assigned advisor" value={advisor ? `${advisor.first_name} ${advisor.last_name}` : "Unassigned"} />
              {primaryBrand && <Field label="Brand" value={primaryBrand.name} />}
              {clientOpportunities.length > 1 && (
                <Field
                  label="Opportunities"
                  value={clientOpportunities
                    .map((o) => brandById.get(o.brand_id)?.name ?? "Unknown brand")
                    .join(", ")}
                />
              )}
              <Field label="Last activity" value={formatRelative(lead.last_activity_at ?? lead.created_at)} />
              <Field
                label="Next consultation"
                value={
                  activeAppointment?.scheduled_start
                    ? formatDateTime(activeAppointment.scheduled_start, activeAppointment.time_zone)
                    : lead.appointment_start_at
                      ? formatDateTime(lead.appointment_start_at)
                      : "None scheduled"
                }
              />
              <Field label="Suggested next action" value={nextAction} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border-soft pt-4">
            <div className="w-56">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Stage</p>
              <StageSelect investorId={lead.id} currentStage={lead.current_stage} />
            </div>
            {isAdmin(user) && (
              <div className="w-56">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Assigned advisor</p>
                <AssignAdvisorSelect
                  investorId={lead.id}
                  currentAdvisorId={lead.assigned_advisor_id}
                  advisors={staff
                    .filter((s) => s.active)
                    .map((s) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` }))}
                />
              </div>
            )}
            <div className="min-w-64 flex-1">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Portal link</p>
              <p className="truncate rounded-control border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
                {portalUrl}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Qualification overview */}
          <Card>
            <CardHeader>
              <CardTitle>Qualification Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {questionnaire ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Liquid capital" value={labelForValue(questionnaire.liquid_capital)} />
                  <Field label="Estimated net worth" value={labelForValue(questionnaire.net_worth)} />
                  <Field
                    label="Investment timeline"
                    value={labelForValue(questionnaire.investment_timeline)}
                  />
                  <Field
                    label="Business ownership"
                    value={labelForValue(questionnaire.business_ownership)}
                  />
                  <Field
                    label="Decision participants"
                    value={labelForValue(questionnaire.decision_participants)}
                  />
                  <Field
                    label="Qualification score"
                    value={
                      lead.qualification_score !== null
                        ? `${lead.qualification_score} (${lead.qualification_result === "qualified" ? "qualified" : "review required"})`
                        : "—"
                    }
                  />
                  <div className="sm:col-span-2">
                    <Field label="What interested them" value={questionnaire.primary_interest} />
                  </div>
                  <div className="sm:col-span-2">
                    <Field
                      label="Questions for the consultation"
                      value={questionnaire.remaining_questions}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Decision criteria" value={questionnaire.decision_criteria} />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Liquid capital (from lead form)"
                    value={labelForValue(lead.initial_liquid_capital)}
                  />
                  <Field
                    label="Net worth (from lead form)"
                    value={labelForValue(lead.initial_net_worth)}
                  />
                  <div className="sm:col-span-2">
                    <p className="text-sm text-muted-foreground">
                      Questionnaire not completed yet.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Questionnaire snapshot */}
          {latestSubmission && (
            <Card>
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
                      <dd className="mt-0.5 text-sm text-foreground">
                        {answer.answer_display_value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Activity timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <ol className="space-y-3">
                  {events.map((event) => {
                    const author = event.created_by_staff_user_id
                      ? staffById.get(event.created_by_staff_user_id)
                      : null;
                    const detail =
                      event.event_name === "stage_changed" && event.event_data
                        ? `${String(event.event_data.oldStage ?? "")} → ${String(event.event_data.newStage ?? "")}`
                        : event.event_name.startsWith("video_progress") && event.event_data?.percent
                          ? `${String(event.event_data.percent)}% watched`
                          : null;
                    return (
                      <li key={event.id} className="flex gap-3 text-sm">
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">
                            {eventLabel(event.event_name)}
                            {detail && (
                              <span className="ml-2 font-normal text-muted-foreground">{detail}</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(event.occurred_at ?? event.created_at)} ·{" "}
                            {eventSourceLabel(event.event_source)}
                            {author ? ` · ${author.first_name} ${author.last_name}` : ""}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          {/* Video engagement */}
          <Card>
            <CardHeader>
              <CardTitle>Video Engagement</CardTitle>
            </CardHeader>
            <CardContent>
              {video ? (
                <div className="space-y-3">
                  <Field label="Percent watched" value={`${Math.round(video.highest_percent_watched)}%`} />
                  <Field
                    label="Total watch time"
                    value={formatWatchTime(video.accumulated_seconds_watched)}
                  />
                  <Field label="Play count" value={String(video.play_count)} />
                  <Field label="First played" value={formatDateTime(video.first_played_at)} />
                  <Field label="Last played" value={formatDateTime(video.last_event_at)} />
                  <Field
                    label="Completed"
                    value={
                      video.completed ? (
                        <Badge variant="success">Yes</Badge>
                      ) : (
                        <Badge variant="neutral">No</Badge>
                      )
                    }
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No video activity yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Appointments */}
          <Card>
            <CardHeader>
              <CardTitle>Consultations</CardTitle>
            </CardHeader>
            <CardContent>
              {appointments.length === 0 && !lead.booked_at ? (
                <p className="text-sm text-muted-foreground">No consultation booked yet.</p>
              ) : appointments.length === 0 ? (
                <div className="space-y-3">
                  <Field label="Status" value={<Badge variant="primary">Scheduled</Badge>} />
                  <Field label="Date" value={formatDateTime(lead.appointment_start_at)} />
                  <Field label="External ID" value={lead.appointment_id ?? "—"} />
                </div>
              ) : (
                <div className="space-y-4">
                  {appointments.map((appointment) => (
                    <div key={appointment.id} className="space-y-3 border-b border-border-soft pb-3 last:border-0 last:pb-0">
                      <Field
                        label="Status"
                        value={
                          <Badge variant={appointment.status === "COMPLETED" ? "success" : "primary"}>
                            {appointment.status}
                          </Badge>
                        }
                      />
                      <Field
                        label="Date & time"
                        value={formatDateTime(appointment.scheduled_start, appointment.time_zone)}
                      />
                      <Field label="Time zone" value={appointment.time_zone ?? "—"} />
                      <Field
                        label="Advisor"
                        value={
                          appointment.advisor_id
                            ? `${staffById.get(appointment.advisor_id)?.first_name ?? ""} ${staffById.get(appointment.advisor_id)?.last_name ?? ""}`.trim() || "—"
                            : "—"
                        }
                      />
                      <Field label="External ID" value={appointment.external_appointment_id ?? "—"} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attribution */}
          <Card>
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

          {/* FDD */}
          <Card>
            <CardHeader>
              <CardTitle>FDD Status</CardTitle>
            </CardHeader>
            <CardContent>
              {fddStatus === "not_requested" ? (
                <p className="text-sm text-muted-foreground">FDD not requested yet.</p>
              ) : (
                <div className="space-y-3">
                  <Field
                    label="Status"
                    value={
                      <Badge
                        variant={
                          fddStatus === "fdd_received" ||
                          fddStatus === "waiting_period_active" ||
                          fddStatus === "eligible_for_agreement"
                            ? "success"
                            : fddStatus === "error_manual_review"
                              ? "outline"
                              : "neutral"
                        }
                      >
                        {FDD_STATUS_LABELS[fddStatus]}
                      </Badge>
                    }
                  />
                  <Field label="Requested" value={formatDateTime(lead.fdd_requested_at)} />
                  <Field label="Sent" value={formatDateTime(lead.fdd_sent_at)} />
                  <Field label="Delivered" value={formatDateTime(lead.fdd_delivered_at)} />
                  <Field label="Received (acknowledged)" value={formatDateTime(lead.fdd_received_at)} />
                  <Field
                    label="Eligible for franchise agreement"
                    value={formatDateTime(lead.fdd_eligible_at)}
                  />
                  {lead.fdd_last_error && (
                    <Field
                      label="Last error"
                      value={<span className="text-destructive">{lead.fdd_last_error}</span>}
                    />
                  )}
                  {fddAudit.length > 0 && (
                    <details className="pt-1">
                      <summary className="cursor-pointer text-sm text-primary">
                        Audit trail ({fddAudit.length})
                      </summary>
                      <ol className="mt-2 space-y-2 border-l border-border-soft pl-3">
                        {fddAudit.map((entry) => (
                          <li key={entry.id} className="text-xs">
                            <p className="font-medium text-foreground">{entry.event.replace(/_/g, " ")}</p>
                            <p className="text-muted-foreground">
                              {formatDateTime(entry.created_at)} · {entry.source}
                              {entry.error ? ` · ${entry.error}` : ""}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Advisor Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <NoteForm investorId={lead.id} />
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                <ul className="space-y-3">
                  {notes.map((note) => {
                    const author = staffById.get(note.staff_user_id);
                    return (
                      <li key={note.id} className="rounded-control border border-border-soft bg-surface p-3">
                        <p className="whitespace-pre-wrap text-sm text-foreground">{note.note}</p>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {author ? `${author.first_name} ${author.last_name}` : "Unknown"} ·{" "}
                          {formatDateTime(note.created_at)}
                          {note.updated_at !== note.created_at
                            ? ` · edited ${formatDateTime(note.updated_at)}`
                            : ""}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
