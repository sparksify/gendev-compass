import type { LeadRecord } from "@/types/lead";
import type { PortalEventRecord } from "@/types/analytics";
import type { VideoProgressRecord } from "@/types/portal";
import type { QuestionnaireRecord } from "@/types/questionnaire";
import type { AppointmentRecord, QuestionnaireSubmissionWithAnswers } from "@/types/advisor";
import { labelIn } from "@/lib/advisor/questionnaireCatalog";
import { INVESTMENT_TIMELINES, LIQUID_CAPITAL_RANGES } from "@/types/questionnaire";
import { getBridgeWistiaMediaId } from "@/lib/config/bridge";
import { getWistiaMediaId } from "@/lib/config/env";
import type { AnswerSnapshotEntry } from "@/lib/bridge/assessment";
import { bridgeCapitalBand } from "@/lib/config/qualification";

export interface IntelligenceSource {
  lead: LeadRecord; events: PortalEventRecord[]; video: VideoProgressRecord | null;
  questionnaire: QuestionnaireRecord | null; submissions: QuestionnaireSubmissionWithAnswers[];
  appointments: AppointmentRecord[];
}
const statuses = ["New", "Engaged", "Fit Assessment Complete", "High Intent", "Questionnaire Complete"];
export function projectIntelligence(source: IntelligenceSource, previousRank = 0, now = Date.now()) {
  const { lead, questionnaire, video } = source;
  const capitalBand = bridgeCapitalBand(lead.initial_liquid_capital);
  const fastTrack = ["100k-249k", "250k-499k", "500k-plus"].includes(lead.initial_liquid_capital ?? "");
  const assessments = source.events.filter(e => e.event_name === "bridge_assessment_submitted" && Array.isArray(e.event_data?.answers))
    .sort((a,b) => a.created_at.localeCompare(b.created_at));
  const assessment = assessments.at(-1);
  const answers = (assessment?.event_data?.answers ?? []) as AnswerSnapshotEntry[];
  const submission = source.submissions.filter(s => s.answers.length > 0).sort((a,b) => b.submitted_at.localeCompare(a.submitted_at))[0];
  const completedQuestionnaire = Boolean(questionnaire && submission);
  const watched = Object.entries(video?.verified_watch ?? {}).filter(([id]) => [getBridgeWistiaMediaId(), getWistiaMediaId()].includes(id))
    .sort(([,a],[,b]) => b.percent-a.percent)[0];
  const highIntent = Boolean(assessment && watched && watched[1].percent >= 30);
  const opened = source.events.find(e => ["bridge_opened", "portal_opened"].includes(e.event_name));
  const rank = Math.max(previousRank, completedQuestionnaire ? 4 : highIntent ? 3 : assessment ? 2 : watched?.[1].seconds || opened ? 1 : 0);
  const booked = source.appointments.some(a => ["SCHEDULED", "RESCHEDULED"].includes(a.status) && (!a.scheduled_end || Date.parse(a.scheduled_end) > now) && (!a.scheduled_start || Date.parse(a.scheduled_start) > now - 3_600_000)) ||
    (source.appointments.length === 0 && Boolean(lead.booked_at)); // unknown-time bookings suppress conservatively
  const times = [assessment?.created_at, submission?.submitted_at, watched?.[1].at, opened?.created_at,
    ...source.appointments.map(a => a.updated_at)].filter((s): s is string => Boolean(s));
  const last = times.sort().at(-1) ?? lead.created_at;
  const reason = completedQuestionnaire ? `Investor questionnaire submitted at ${submission.submitted_at}.` : highIntent ?
    `Bridge fit assessment completed; ${Math.floor(watched![1].percent)}% unique overview watch confirmed at ${watched![1].at}.` : assessment ?
    `Bridge fit assessment submitted at ${assessment.created_at}.` : watched ?
    `Overview playback reported at ${watched[1].at}.` : opened ? `Identified page opened at ${opened.created_at}.` : `Lead created at ${lead.created_at}.`;
  const bridgeText = (assessment ? [assessment] : []).map(a => {
    const entries = a.event_data!.answers as AnswerSnapshotEntry[];
    return [`Short bridge fit assessment — ${String(a.event_data!.version ?? "Version not recorded")}`, `Submitted: ${a.created_at}`,
      ...entries.map(x => `${x.question}\n${x.label}`),
      ...(!entries.some(x => x.key === "notes") ? ["Anything else you’d like us to know?\nNot provided"] : [])].join("\n\n");
  }).join("\n\n──────────\n\n");
  const bridgeValue = (key: string) => answers.find(a => a.key === key)?.label ?? "Not provided";
  const summary = [
    `Bridge fit: ${assessment ? assessment.event_data?.fit === "strong" ? "Strong (capital + timeline rule)" : "Standard" : "Not assessed"}`,
    `Investor qualification: ${lead.qualification_result === "qualified" ? "Qualified" : lead.qualification_result === "review_required" ? "Review required" : "Pending"}`,
    `Timeline: ${questionnaire ? labelIn(INVESTMENT_TIMELINES, questionnaire.investment_timeline) : bridgeValue("timeline")}`,
    `Liquid capital: ${questionnaire ? labelIn(LIQUID_CAPITAL_RANGES, questionnaire.liquid_capital) : bridgeValue("liquidCapital")}`,
  ].join("\n");
  const taskLevel = completedQuestionnaire ? 3 : highIntent ? 2 : assessment ? 1 : 0;
  return { rank, booked, taskLevel, submission: completedQuestionnaire ? submission : undefined, bridgeText,
    taskTitle: completedQuestionnaire ? "REVIEW / CALL — Investor questionnaire complete" : highIntent ? "CALL NOW — Bridge assessment + overview engagement" : "Follow up — Bridge fit assessment complete",
    tags: [
      assessment && "Compass: Fit Assessment Complete",
      (highIntent || previousRank === 3) && "Compass: High Intent",
      completedQuestionnaire && "Compass: Questionnaire Complete",
      fastTrack && "CMDT – Fast Track – $100K+",
      capitalBand === "50k-plus" && !fastTrack && "CMDT – Qualified – $50K–$99K",
      capitalBand === "25k-49k" && "CMDT – Financial Review – $25K–$49K",
      capitalBand === "under-25k" && "CMDT – Nurture – <$25K",
      capitalBand === "unknown" && "CMDT – Financial Clarification – Unsure",
    ].filter((s): s is string => Boolean(s)),
    fields: {
      "contact.compass_engagement_status": statuses[rank],
      "contact.compass_why_this_lead_matters": reason,
      "contact.compass_next_action": booked ? "Appointment booked" : completedQuestionnaire ? "Review assessment" : highIntent ? "Call now" : assessment ? "Follow up" : "None",
      "contact.compass_bridge_fit_assessment": assessment ? `Complete — ${assessment.created_at}` : "Not submitted",
      "contact.compass_overview_video": watched ? `${Math.floor(watched[1].percent)}% unique watch (${Math.floor(watched[1].seconds)} seconds; ${watched[0] === getBridgeWistiaMediaId() ? "bridge overview" : "investor overview"})` : video?.started ? "Playback recorded; unique watch unverified" : "No verified viewing recorded",
      "contact.compass_investor_questionnaire": completedQuestionnaire ? `Complete — ${submission.submitted_at}. Full answers: Compass investor questionnaire notes. CQ Upload PDF: pending verification.` : questionnaire ? "Responses saved; answer archive pending — retry required" : "Not submitted",
      "contact.compass_qualification_summary": summary,
      "contact.compass_last_meaningful_activity": last,
      "contact.compass_bridge_answers": bridgeText || "Not submitted",
    },
  };
}
/** Split at whole answers; no answer is truncated. Native notes support rich
 * text, so HTML-escape prospect input and preserve line breaks explicitly. */
export function questionnaireNotes(submission: QuestionnaireSubmissionWithAnswers): string[] {
  const header = `Compass investor questionnaire — v${submission.questionnaire_version}\nSubmitted: ${submission.submitted_at}`;
  const chunks: string[] = []; let current = header;
  for (const a of submission.answers) {
    const text = `\n\n${a.question_text}\n${a.answer_display_value}`;
    if (current.length + text.length > 12000 && current !== header) { chunks.push(current); current = header; }
    current += text;
  }
  chunks.push(current); return chunks;
}
export function noteHtml(text: string) {
  return text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/\n/g,"<br>");
}
