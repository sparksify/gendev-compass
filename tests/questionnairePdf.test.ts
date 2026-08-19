import { describe, expect, it } from "vitest";
import { renderQuestionnairePdf } from "@/lib/advisor/questionnairePdf";
import { makeLead } from "./helpers";
import type { QuestionnaireRecord } from "@/types/questionnaire";

function makeQuestionnaire(overrides: Partial<QuestionnaireRecord> = {}): QuestionnaireRecord {
  const now = new Date("2026-08-19T14:25:00Z").toISOString();
  return {
    id: "q-1",
    lead_id: "lead-1",
    investment_timeline: "within-30-days",
    liquid_capital: "lt-100k",
    net_worth: "lt-500k",
    business_ownership: "no",
    primary_interest: "Recurring revenue and “semi-absentee” ownership — freedom to do things my way.",
    remaining_questions: "Territory availability?\nFinancing options?",
    decision_criteria: "Everything is clear to my understanding.",
    decision_participants: "independent",
    accuracy_confirmed: true,
    created_at: now,
    updated_at: now,
    opportunity_id: null,
    address_line_1: "300 White Oak Dr",
    address_line_2: null,
    city: "Barnwell",
    state: "SC",
    postal_code: "29812",
    country: "United States",
    estimated_credit_score_range: "640-679",
    anticipated_funding_sources: ["other"],
    financing_need: "possibly",
    preferred_financing_percentage: "lt-25",
    available_cash_contribution: "prefer-not-to-say",
    lender_status: "no",
    funding_assistance_requested: "possibly",
    funding_followup_requested: false,
    existing_business_entity: "yes",
    prior_business_financing_experience: "no",
    ...overrides,
  };
}

describe("renderQuestionnairePdf", () => {
  it("renders a complete questionnaire to a valid PDF", async () => {
    const bytes = await renderQuestionnairePdf({
      lead: makeLead({ qualification_result: "review_required", qualification_score: 25 }),
      questionnaire: makeQuestionnaire(),
      submittedAt: "2026-08-19T14:25:02Z",
      questionnaireVersion: "1.1",
    });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(2000);
  });

  it("tolerates pre-v1.1 records with null location/funding fields", async () => {
    const bytes = await renderQuestionnairePdf({
      lead: makeLead(),
      questionnaire: makeQuestionnaire({
        address_line_1: null,
        city: null,
        state: null,
        postal_code: null,
        country: null,
        estimated_credit_score_range: null,
        anticipated_funding_sources: null,
        financing_need: null,
        preferred_financing_percentage: null,
        available_cash_contribution: null,
        lender_status: null,
        funding_assistance_requested: null,
        existing_business_entity: null,
        prior_business_financing_experience: null,
      }),
      submittedAt: null,
      questionnaireVersion: null,
    });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("survives very long free-text answers without overflowing pages", async () => {
    const bytes = await renderQuestionnairePdf({
      lead: makeLead(),
      questionnaire: makeQuestionnaire({
        primary_interest: "A very long answer. ".repeat(300),
        remaining_questions: `${"Superlongunbrokenword".repeat(40)}\n\nMore lines follow.`,
        decision_criteria: "Line one.\nLine two.\nLine three. ".repeat(80),
      }),
      submittedAt: "2026-08-19T14:25:02Z",
      questionnaireVersion: "1.1",
    });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});
