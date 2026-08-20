/**
 * Renders an advisor notification email to an HTML file so the copy and
 * layout can be reviewed in a browser without sending anything.
 *
 *   npx tsx scripts/preview-notification-email.ts <output-dir> [template]
 *
 * template: questionnaire_completed (default) | ownership_profile_completed
 *
 * Runs against a throwaway dev store in a temp directory and never loads
 * .env.local, so it cannot touch Supabase or send mail.
 */
import os from "os";
import path from "path";
import { mkdtempSync, writeFileSync } from "fs";

async function main(): Promise<void> {
  const outDir = process.argv[2] ?? process.cwd();
  const templateKey = (process.argv[3] ?? "questionnaire_completed") as
    | "questionnaire_completed"
    | "ownership_profile_completed";

  // Isolate: no Supabase env loaded => file-backed dev store, in a temp dir.
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_APP_URL = "https://gendevcompass.com";
  process.chdir(mkdtempSync(path.join(os.tmpdir(), "email-preview-")));

  const { getStore } = await import("@/lib/store");
  const { buildEmailBody } = await import("@/lib/notifications/templates");
  const store = getStore();

  const created = await store.createLead({
    portal_token: "preview-token-0123456789abcdef",
    first_name: "Marcus",
    last_name: "Whitfield",
    email: "marcus.whitfield@example.com",
    phone: "(214) 555-0182",
    state: "Texas",
    source: "facebook",
    campaign: "cmdt-q3",
    ad_set: null,
    ad: null,
    facebook_lead_id: null,
    initial_liquid_capital: null,
    initial_net_worth: null,
    initial_business_owner: null,
  });

  const lead = await store.updateLead(created.id, {
    qualification_result: "qualified",
    qualification_score: 78,
    questionnaire_completed_at: new Date().toISOString(),
  });

  await store.createQuestionnaire({
    lead_id: lead.id,
    investment_timeline: "within-90-days",
    liquid_capital: "500k-999k",
    net_worth: "1m-2.4m",
    business_ownership: "yes-previously",
    primary_interest:
      "The recurring-revenue model and the fact that testing demand is driven by compliance rather than discretionary spend. I ran a logistics company for nine years and this looks far less cyclical.",
    remaining_questions:
      "What does the ramp to profitability actually look like month by month, and how much of my own time does it take in year one?",
    decision_criteria:
      "Protected territory, a realistic path to $1M in revenue within 24 months, and a franchisor that has already solved the hiring problem.",
    decision_participants: "spouse",
    accuracy_confirmed: true,
      // Questionnaire v1.1 fields — representative preview values.
    address_line_1: "4821 Maple Grove Lane",
    address_line_2: null,
    city: "Plano",
    state: "TX",
    postal_code: "75024",
    country: "United States",
    estimated_credit_score_range: "720-759",
    anticipated_funding_sources: ["cash", "sba-financing"],
    financing_need: "possibly",
    preferred_financing_percentage: "25-49",
    available_cash_contribution: "150k-249k",
    lender_status: "initial-conversation",
    funding_assistance_requested: "possibly",
    funding_followup_requested: false,
    existing_business_entity: "no",
    prior_business_financing_experience: "no",
});

  await store.upsertVideoProgress(lead.id, {
    highest_percent_watched: 94,
    completed: true,
  });

  await store.upsertOwnershipProfile({
    lead_id: lead.id,
    motivations: ["long-term-wealth", "leave-corporate", "freedom"],
    activities: ["leading-team", "building-systems", "strategic-planning"],
    ownership_style: 72,
    growth_comfort: "regional-expansion",
    environments: ["healthcare", "b2b-services"],
    priorities: ["recurring-revenue", "scalability", "predictable-demand"],
    experience: ["business-owner", "operations", "military"],
    timeline: "actively-evaluating",
    current_step: 8,
    answered_sections: 8,
    completed_at: new Date().toISOString(),
  });

  const body = await buildEmailBody(templateKey, {
    lead,
    eventData: { questionnaireVersion: "1.0" },
  });
  if (!body) throw new Error("Template returned nothing");

  const htmlPath = path.join(outDir, `${templateKey.replace(/_/g, "-")}-preview.html`);
  writeFileSync(htmlPath, body.html, "utf8");

  console.log(`Subject: ${body.subject}`);
  console.log(`HTML:    ${htmlPath}`);
  console.log("\n--- plain-text alternative ---\n");
  console.log(body.text);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
