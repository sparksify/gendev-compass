import { NextResponse } from "next/server";
import { requireStaffAndLead } from "@/lib/advisor/api";
import { getStore } from "@/lib/store";
import { deriveNextBestAction } from "@/lib/advisor/nextBestAction";
import { effectiveFddStatus, FDD_STATUS_LABELS } from "@/lib/fdd/status";
import { eventLabel, formatDate, formatRelative, formatWatchTime } from "@/lib/advisor/format";
import { labelForValue } from "@/lib/advisor/questionnaireCatalog";
import { regionForState } from "@/lib/advisor/regions";
import { resolveClientFromLead } from "@/lib/domain/clients";
import { listOpportunitiesForClient } from "@/lib/domain/opportunities";
import { getAppUrl } from "@/lib/config/env";

export const dynamic = "force-dynamic";

/** Everything the slide-in Client Details panel renders, in one payload —
 * assembled from the same loaders/derivations as the full detail page. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const resolved = await requireStaffAndLead(request, id);
  if ("response" in resolved) return resolved.response;
  const { lead } = resolved;

  const store = getStore();
  const [questionnaire, video, appointments, notes, events] = await Promise.all([
    store.getQuestionnaire(lead.id),
    store.getVideoProgress(lead.id),
    store.getAppointmentsForLead(lead.id),
    store.getNotesForLead(lead.id),
    store.getEventsForLead(lead.id),
  ]);

  let brandName: string | null = null;
  try {
    const client = await resolveClientFromLead(lead);
    if (client) {
      const opportunities = await listOpportunitiesForClient(client.id);
      const primary =
        opportunities.find((o) => o.id === lead.primary_opportunity_id) ??
        opportunities.find((o) => o.source_lead_id === lead.id) ??
        null;
      if (primary) {
        const brands = await store.listBrands();
        brandName = brands.find((b) => b.id === primary.brand_id)?.name ?? null;
      }
    }
  } catch {
    brandName = null;
  }

  const action = deriveNextBestAction(lead, questionnaire, video, appointments, events, notes.length);
  const fddStatus = effectiveFddStatus(lead);
  const activeAppointment = appointments.find(
    (a) => a.status === "SCHEDULED" || a.status === "RESCHEDULED",
  );
  const consultationDone = appointments.some((a) => a.status === "COMPLETED");
  const lastActivityAt = lead.last_activity_at ?? lead.created_at;
  const staff = await store.listStaffUsers();
  const staffNameById = new Map(staff.map((s) => [s.id, s.first_name]));
  const latestNote = notes[0] ?? null;
  const stateToken = questionnaire?.state ?? lead.state;

  return NextResponse.json({
    success: true,
    panel: {
      id: lead.id,
      name: `${lead.first_name} ${lead.last_name}`,
      email: lead.email,
      phone: lead.phone,
      brandName,
      stage: lead.current_stage,
      isHot: Date.now() - new Date(lastActivityAt).getTime() <= 24 * 3_600_000,
      portalUrl: `${getAppUrl()}/p/${lead.portal_token}`,
      video: video
        ? {
            percent: Math.min(100, Math.max(0, video.highest_percent_watched)),
            watchTime: formatWatchTime(video.accumulated_seconds_watched),
            playCount: video.play_count,
          }
        : null,
      lastActivity: {
        relative: formatRelative(lastActivityAt),
        label: events[0] ? eventLabel(events[0].event_name) : null,
      },
      nextBestAction: {
        title: action.title,
        sub: action.description,
        mailto: action.reminder
          ? `mailto:${lead.email}?subject=${encodeURIComponent(action.reminder.subject)}&body=${encodeURIComponent(action.reminder.body)}`
          : null,
      },
      financial: {
        liquidCapital: labelForValue(questionnaire?.liquid_capital ?? lead.initial_liquid_capital),
        netWorth: labelForValue(questionnaire?.net_worth ?? lead.initial_net_worth),
        timeline: questionnaire?.investment_timeline
          ? labelForValue(questionnaire.investment_timeline)
          : "—",
        ownedBusiness: questionnaire?.business_ownership
          ? labelForValue(questionnaire.business_ownership)
          : lead.initial_business_owner === null
            ? "—"
            : lead.initial_business_owner
              ? "Yes"
              : "No",
      },
      progress: {
        consultation: activeAppointment
          ? {
              label: `Scheduled · ${formatDate(activeAppointment.scheduled_start)}`,
              tone: "amber",
            }
          : consultationDone
            ? { label: "Completed", tone: "green" }
            : lead.booked_at
              ? { label: `Scheduled · ${formatDate(lead.appointment_start_at)}`, tone: "amber" }
              : { label: "Not booked", tone: "neutral" },
        fdd: {
          label: fddStatus === "not_requested" ? "Not requested" : FDD_STATUS_LABELS[fddStatus],
          tone:
            fddStatus === "not_requested" || fddStatus === "error_manual_review"
              ? "neutral"
              : fddStatus === "fdd_received" ||
                  fddStatus === "waiting_period_active" ||
                  fddStatus === "eligible_for_agreement"
                ? "green"
                : "amber",
          inFlight: fddStatus !== "not_requested" && fddStatus !== "error_manual_review",
        },
        funding: !questionnaire
          ? { label: "Not started", tone: "neutral" }
          : questionnaire.funding_followup_requested
            ? { label: "Assistance requested", tone: "amber" }
            : { label: "Provided", tone: "green" },
        questionnaire: lead.questionnaire_completed_at || questionnaire
          ? { label: "Completed", tone: "green", completed: true }
          : lead.questionnaire_started_at
            ? { label: "Pending", tone: "amber", completed: false }
            : { label: "Not started", tone: "neutral", completed: false },
      },
      milestones: lead.process_milestones ?? {},
      leadSource: {
        type: lead.lead_type ?? "organic",
        brokerName: lead.broker_name ?? null,
        brokerNetwork: lead.broker_network ?? null,
        brokerEmail: lead.broker_email ?? null,
        brokerPhone: lead.broker_phone ?? null,
        channel: lead.source ?? lead.first_utm_source,
        campaign: lead.campaign ?? lead.first_utm_campaign,
        medium: lead.first_utm_medium,
        landingPage: lead.first_landing_page,
      },
      territoriesWanted: lead.territories_wanted ?? null,
      territory:
        questionnaire?.city && questionnaire.state
          ? `${questionnaire.city}, ${questionnaire.state}`
          : (regionForState(stateToken) ?? "Not provided"),
      latestNote: latestNote
        ? {
            body: latestNote.note,
            author: staffNameById.get(latestNote.staff_user_id) ?? "Advisor",
            when: formatRelative(latestNote.created_at),
          }
        : null,
      notesCount: notes.length,
    },
  });
}
