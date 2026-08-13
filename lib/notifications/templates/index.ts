import { getStore } from "@/lib/store";
import { brand } from "@/lib/config/brand";
import { labelForValue } from "@/lib/advisor/questionnaireCatalog";
import {
  activityLabels,
  environmentLabels,
  experienceLabels,
  growthComfortLabel,
  motivationLabels,
  ownershipStyleLabel,
  priorityLabels,
  timelineLabel,
  toOwnershipProfileInput,
} from "@/types/ownershipProfile";
import type { LeadRecord } from "@/types/lead";
import type { EmailTemplateKey } from "@/lib/notifications/rules";
import {
  investorName,
  investorUrl,
  renderEmail,
  type DetailRow,
  type EmailBody,
} from "./layout";

/**
 * Builds the advisor-facing email for a notifiable event.
 *
 * Every field shown here is read from data the application already stores.
 * Nothing is inferred or invented, and any value that is absent is dropped
 * from the email rather than rendered as a blank or a placeholder.
 */

export interface TemplateContext {
  lead: LeadRecord;
  eventData: Record<string, unknown> | null;
}

export async function buildEmailBody(
  templateKey: EmailTemplateKey,
  context: TemplateContext,
): Promise<EmailBody | null> {
  switch (templateKey) {
    case "questionnaire_completed":
      return questionnaireCompleted(context);
    case "consultation_scheduled":
      return consultationScheduled(context);
    case "strategist_review_requested":
      return strategistReviewRequested(context);
    case "video_completed":
      return videoCompleted(context);
    case "ownership_profile_completed":
      return ownershipProfileCompleted(context);
    default:
      return null;
  }
}

/** Contact block shared by every template. */
function contactRows(lead: LeadRecord): DetailRow[] {
  return [
    { label: "Email", value: lead.email },
    { label: "Phone", value: lead.phone },
    { label: "State", value: lead.state },
  ];
}

function cta(lead: LeadRecord): { href: string; label: string } | null {
  const href = investorUrl(lead);
  return href ? { href, label: "View Investor" } : null;
}

// ---------------------------------------------------------------------------
// The V1 headline notification.
// ---------------------------------------------------------------------------

async function questionnaireCompleted(context: TemplateContext): Promise<EmailBody> {
  const { lead } = context;
  const store = getStore();
  const name = investorName(lead);

  const [questionnaire, videoProgress] = await Promise.all([
    store.getQuestionnaire(lead.id).catch(() => null),
    store.getVideoProgress(lead.id).catch(() => null),
  ]);

  // Qualification is scored server-side at submission; surface it only once
  // it exists on the record.
  const qualification =
    lead.qualification_result === "qualified"
      ? "Qualified"
      : lead.qualification_result === "review_required"
        ? "Review required"
        : null;

  const score =
    typeof lead.qualification_score === "number" ? `${lead.qualification_score}` : null;

  const watched = videoProgress
    ? `${Math.round(videoProgress.highest_percent_watched)}%${videoProgress.completed ? " (completed)" : ""}`
    : null;

  const rows: DetailRow[] = [
    ...contactRows(lead),
    { label: "Qualification", value: qualification },
    { label: "Score", value: score },
    { label: "Overview video", value: watched },
  ];

  if (questionnaire) {
    rows.push(
      { label: "Timeline", value: labelForValue(questionnaire.investment_timeline) },
      { label: "Liquid capital", value: labelForValue(questionnaire.liquid_capital) },
      { label: "Net worth", value: labelForValue(questionnaire.net_worth) },
      { label: "Owned a business", value: labelForValue(questionnaire.business_ownership) },
      {
        label: "Decision participants",
        value: labelForValue(questionnaire.decision_participants),
      },
      { label: "What interested them most", value: questionnaire.primary_interest, block: true },
      {
        label: "Questions for the consultation",
        value: questionnaire.remaining_questions,
        block: true,
      },
      { label: "Decision criteria", value: questionnaire.decision_criteria, block: true },
    );
  }

  const { html, text } = renderEmail({
    eyebrow: "Investor Qualification",
    headline: `${name} completed the ${brand.brandName} Investor Qualification.`,
    intro: "Their responses are below and on the full record in Compass.",
    rows,
    cta: cta(lead),
    footnote: "You receive this because qualification completions are set to notify immediately.",
  });

  return { subject: `Investor Qualification Completed — ${name}`, html, text };
}

// ---------------------------------------------------------------------------

async function consultationScheduled(context: TemplateContext): Promise<EmailBody> {
  const { lead, eventData } = context;
  const name = investorName(lead);

  const startsAt = formatWhen(
    asString(eventData?.scheduledStart) ?? lead.appointment_start_at,
  );

  const { html, text } = renderEmail({
    eyebrow: "Consultation",
    headline: `${name} scheduled a consultation.`,
    intro: "Review their qualification responses before the call.",
    rows: [...contactRows(lead), { label: "Scheduled for", value: startsAt }],
    cta: cta(lead),
  });

  return { subject: `Consultation Scheduled — ${name}`, html, text };
}

async function strategistReviewRequested(context: TemplateContext): Promise<EmailBody> {
  const { lead, eventData } = context;
  const store = getStore();
  const name = investorName(lead);

  // The prospect's own message is the substance of this request.
  let message: string | null = null;
  const requestId = asString(eventData?.reviewRequestId);
  if (requestId) {
    const request = await store.getTerritoryReviewRequest(requestId).catch(() => null);
    // Guard against a foreign id ever reaching the template.
    if (request && request.lead_id === lead.id) message = request.prospect_message;
  }

  const { html, text } = renderEmail({
    eyebrow: "Territory Review",
    headline: `${name} requested a territory review.`,
    intro: "A strategist review was requested from the Territory Advisor.",
    rows: [...contactRows(lead), { label: "Their message", value: message, block: true }],
    cta: cta(lead),
  });

  return { subject: `Territory Review Requested — ${name}`, html, text };
}

/**
 * The pre-call brief: what this investor says they want out of ownership.
 * Every row is their own selection, rendered as labels rather than the
 * stored option keys.
 */
async function ownershipProfileCompleted(context: TemplateContext): Promise<EmailBody> {
  const { lead } = context;
  const name = investorName(lead);
  const row = await getStore()
    .getOwnershipProfile(lead.id)
    .catch(() => null);

  const rows: DetailRow[] = [...contactRows(lead)];

  if (row) {
    const profile = toOwnershipProfileInput(row);
    rows.push(
      { label: "Ownership style", value: ownershipStyleLabel(profile.ownershipStyle) },
      { label: "Timeline", value: timelineLabel(profile) },
      { label: "Growth comfort", value: growthComfortLabel(profile) },
      { label: "Motivations", value: joinLabels(motivationLabels(profile)), block: true },
      { label: "Priorities", value: joinLabels(priorityLabels(profile)), block: true },
      { label: "Enjoys doing", value: joinLabels(activityLabels(profile)), block: true },
      { label: "Industries of interest", value: joinLabels(environmentLabels(profile)), block: true },
      { label: "Background", value: joinLabels(experienceLabels(profile)), block: true },
    );
  }

  const { html, text } = renderEmail({
    eyebrow: "Ownership Profile",
    headline: `${name} completed their Ownership Profile.`,
    intro: "What they say they want from ownership — useful context before the call.",
    rows,
    cta: cta(lead),
    footnote: "This is a self-assessment, not a qualification score.",
  });

  return { subject: `Ownership Profile Completed — ${name}`, html, text };
}

/** Multi-select answers read better as a list than a run-on sentence. */
function joinLabels(labels: string[]): string | null {
  return labels.length > 0 ? labels.join(" · ") : null;
}

async function videoCompleted(context: TemplateContext): Promise<EmailBody> {
  const { lead, eventData } = context;
  const name = investorName(lead);
  const percent = asString(eventData?.highestPercent);

  const { html, text } = renderEmail({
    eyebrow: "Investor Overview",
    headline: `${name} finished the investor overview video.`,
    intro: "They have not necessarily completed qualification yet.",
    rows: [...contactRows(lead), { label: "Watched", value: percent ? `${percent}%` : null }],
    cta: cta(lead),
  });

  return { subject: `Overview Video Completed — ${name}`, html, text };
}

// ---------------------------------------------------------------------------

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number") return String(Math.round(value));
  return null;
}

/** Formats in the brand's time zone; falls back to the raw value if unparseable. */
function formatWhen(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: brand.timeZone,
  }).format(date);
}
