/**
 * uploadQuestionnairePdfToGhl against the dev store with a mocked
 * GoHighLevel API: resolves the contact (upsert fallback), resolves the
 * cq_upload field id by key, and posts the PDF as multipart form data.
 */
import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PortalStore } from "@/lib/store/types";
import type { LeadRecord } from "@/types/lead";

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "ghl-upload-test-"));
const originalCwd = process.cwd();

let store: PortalStore;
let uploadQuestionnairePdfToGhl: typeof import("@/lib/ghl/questionnaireUpload").uploadQuestionnairePdfToGhl;
let lead: LeadRecord;

beforeAll(async () => {
  process.chdir(tmpDir);
  process.env.GHL_API_TOKEN = "test-token";
  process.env.GHL_LOCATION_ID = "4dwsLmHGWb6ElyIQlZOc";

  const storeModule = await import("@/lib/store");
  store = storeModule.getStore();
  ({ uploadQuestionnairePdfToGhl } = await import("@/lib/ghl/questionnaireUpload"));

  lead = await store.createLead({
    portal_token: "token-ghl-test-0123456789abcdef",
    first_name: "Mark",
    last_name: "Anthony",
    email: "markah65@example.test",
    phone: "+15550000000",
    source: "facebook",
    campaign: null,
    ad_set: null,
    ad: null,
    facebook_lead_id: null,
    initial_liquid_capital: null,
    initial_net_worth: null,
    initial_business_owner: null,
  });
  await store.createQuestionnaire({
    lead_id: lead.id,
    investment_timeline: "within-30-days",
    liquid_capital: "lt-100k",
    net_worth: "lt-500k",
    business_ownership: "no",
    primary_interest: "Freedom.",
    remaining_questions: "None.",
    decision_criteria: "Clear.",
    decision_participants: "independent",
    accuracy_confirmed: true,
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
  });
});

afterAll(() => {
  process.chdir(originalCwd);
  rmSync(tmpDir, { recursive: true, force: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("uploadQuestionnairePdfToGhl", () => {
  it("uploads the PDF into the cq_upload field via the GHL API", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, init });
        if (url.includes("/contacts/upsert")) {
          return jsonResponse({ contact: { id: "ghl-contact-1" } });
        }
        if (url.includes("/customFields")) {
          return jsonResponse({
            customFields: [
              { id: "field-other", fieldKey: "contact.something_else" },
              { id: "field-cq", fieldKey: "contact.cq_upload" },
            ],
          });
        }
        if (url.includes("/forms/upload-custom-files")) {
          return jsonResponse({ uploadedFiles: {} });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const result = await uploadQuestionnairePdfToGhl(lead);
    expect(result).toEqual({
      ok: true,
      contactId: "ghl-contact-1",
      fieldId: "field-cq",
      error: null,
    });

    const uploadCall = calls.find((c) => c.url.includes("/forms/upload-custom-files"));
    expect(uploadCall).toBeDefined();
    expect(uploadCall?.url).toContain("contactId=ghl-contact-1");
    expect(uploadCall?.url).toContain("locationId=4dwsLmHGWb6ElyIQlZOc");
    const form = uploadCall?.init?.body as FormData;
    const file = form.get("field-cq") as File;
    expect(file).toBeInstanceOf(Blob);
    expect(file.type).toBe("application/pdf");
    expect(file.size).toBeGreaterThan(1000);
    expect(file.name).toBe("investor-qualification-mark-anthony.pdf");
  });

  it("reports failure without throwing when the cq_upload field is missing", async () => {
    // The field-id cache is per location — use a different location so the
    // previous test's cached id does not satisfy the lookup.
    process.env.GHL_LOCATION_ID = "other-location";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/contacts/upsert")) {
          return jsonResponse({ contact: { id: "ghl-contact-1" } });
        }
        if (url.includes("/customFields")) {
          return jsonResponse({ customFields: [] });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const result = await uploadQuestionnairePdfToGhl(lead);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("cq_upload");
    process.env.GHL_LOCATION_ID = "4dwsLmHGWb6ElyIQlZOc";
  });
});
