import { getStore } from "@/lib/store";
import { brand } from "@/lib/config/brand";
import { labelForValue, labelIn } from "@/lib/advisor/questionnaireCatalog";
import {
  CREDIT_SCORE_RANGES,
  CASH_CONTRIBUTION_RANGES,
  EXISTING_ENTITY_OPTIONS,
  FINANCING_NEED_OPTIONS,
  FINANCING_PERCENTAGE_OPTIONS,
  FUNDING_ASSISTANCE_OPTIONS,
  FUNDING_SOURCE_OPTIONS,
  LENDER_STATUS_OPTIONS,
  PRIOR_FINANCING_EXPERIENCE_OPTIONS,
} from "@/types/questionnaire";
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
    case "booking_claimed":
      return bookingClaimed(context);
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
    // Full mailing address as one line; parts that are absent drop out.
    const addressParts = [
      [questionnaire.address_line_1, questionnaire.address_line_2].filter(Boolean).join(", "),
      [questionnaire.city, questionnaire.state].filter(Boolean).join(", "),
      questionnaire.postal_code,
      questionnaire.country,
    ].filter(Boolean);
    const mailingAddress = addressParts.length > 0 ? addressParts.join(" · ") : null;

    const fundingSources =
      Array.isArray(questionnaire.anticipated_funding_sources) &&
      questionnaire.anticipated_funding_sources.length > 0
        ? questionnaire.anticipated_funding_sources
            .map((source) => labelIn(FUNDING_SOURCE_OPTIONS, source))
            .join(", ")
        : null;

    // The financing-detail trio only exists when financing may be in play.
    const financingApplies = Boolean(
      questionnaire.financing_need && questionnaire.financing_need !== "no",
    );

    rows.push(
      { label: "Timeline", value: labelForValue(questionnaire.investment_timeline) },
      { label: "Liquid capital", value: labelForValue(questionnaire.liquid_capital) },
      { label: "Net worth", value: labelForValue(questionnaire.net_worth) },
      { label: "Mailing address", value: mailingAddress },
      {
        label: "Credit score (self-reported)",
        value: labelIn(CREDIT_SCORE_RANGES, questionnaire.estimated_credit_score_range),
      },
      { label: "Funding sources", value: fundingSources },
      {
        label: "Financing need",
        value: labelIn(FINANCING_NEED_OPTIONS, questionnaire.financing_need),
      },
      ...(financingApplies
        ? [
            {
              label: "Prefers to finance",
              value: labelIn(
                FINANCING_PERCENTAGE_OPTIONS,
                questionnaire.preferred_financing_percentage,
              ),
            },
            {
              label: "Lender status",
              value: labelIn(LENDER_STATUS_OPTIONS, questionnaire.lender_status),
            },
            {
              label: "Wants financing help",
              value: labelIn(FUNDING_ASSISTANCE_OPTIONS, questionnaire.funding_assistance_requested),
            },
          ]
        : []),
      {
        label: "Cash contribution",
        value: labelIn(CASH_CONTRIBUTION_RANGES, questionnaire.available_cash_contribution),
      },
      {
        label: "Existing business entity",
        value: labelIn(EXISTING_ENTITY_OPTIONS, questionnaire.existing_business_entity),
      },
      {
        label: "Prior SBA/commercial financing",
        value: labelIn(
          PRIOR_FINANCING_EXPERIENCE_OPTIONS,
          questionnaire.prior_business_financing_experience,
        ),
      },
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
    intro: "Their responses are below, attached as a PDF, and on the full record in Compass.",
    rows,
    cta: cta(lead),
    footnote: "You receive this because qualification completions are set to notify immediately.",
  });

  // Attach the formatted questionnaire report. Best-effort: a PDF render
  // failure must not cost the advisor the notification itself.
  let attachments: EmailBody["attachments"];
  if (questionnaire) {
    try {
      const { renderQuestionnairePdf } = await import("@/lib/advisor/questionnairePdf");
      const submissions = await store.getSubmissionsForLead(lead.id).catch(() => []);
      const latest = submissions[0] ?? null;
      const pdf = await renderQuestionnairePdf({
        lead,
        questionnaire,
        submittedAt:
          latest?.submitted_at ?? lead.questionnaire_completed_at ?? questionnaire.created_at,
        questionnaireVersion: latest?.questionnaire_version ?? null,
      });
      const safeName = `${lead.first_name}-${lead.last_name}`
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      attachments = [
        {
          filename: `investor-qualification-${safeName || lead.id}.pdf`,
          contentBase64: Buffer.from(pdf).toString("base64"),
        },
      ];
    } catch (error) {
      console.error(`[notifications] questionnaire PDF attach failed for lead ${lead.id}:`, error);
    }
  }

  return { subject: `Investor Qualification Completed — ${name}`, html, text, attachments };
}

// ---------------------------------------------------------------------------

/**
 * The prospect clicked "I completed my booking" but no booking was detected
 * from the calendar widget or webhook — an action-required verification
 * email, deliberately distinct from the confirmed-booking template.
 */
async function bookingClaimed(context: TemplateContext): Promise<EmailBody> {
  const { lead } = context;
  const name = investorName(lead);

  const qualification =
    lead.qualification_result === "qualified"
      ? "Qualified"
      : lead.qualification_result === "review_required"
        ? "Review required"
        : null;

  const rows: DetailRow[] = [
    ...contactRows(lead),
    { label: "Qualification", value: qualification },
    { label: "Calendar booking detected", value: "No" },
  ];

  const { html, text } = renderEmail({
    eyebrow: "Verify Booking",
    headline: `${name} says they scheduled a consultation — no calendar booking was detected.`,
    intro:
      "They clicked the confirmation button on the scheduling page, but no booking event arrived from the calendar. Check your calendar; if nothing is there, reach out to get them scheduled — they intended to book.",
    rows,
    cta: cta(lead),
    footnote: "You receive this because unverified booking claims are set to notify immediately.",
  });

  return { subject: `Verify booking — ${name} (no calendar event found)`, html, text };
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
