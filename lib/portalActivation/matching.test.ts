import { describe, expect, it } from "vitest";
import {
  classifyAutoMatch,
  classifyLastFourMatch,
  computeMatchWindow,
  selectEligibleCandidates,
} from "./matching";
import type { ActivationCriteria, ExternalLeadRecord } from "@/types/portalActivation";

const BASE_TIME = new Date("2026-08-05T18:00:00.000Z");

function lead(overrides: Partial<ExternalLeadRecord> = {}): ExternalLeadRecord {
  return {
    id: overrides.id ?? `lead-${Math.random().toString(36).slice(2)}`,
    highlevel_contact_id: "contact-1",
    highlevel_location_id: "loc-1",
    brand_slug: "cmdt",
    advisor_id: null,
    first_name: "Test",
    last_name: "Lead",
    normalized_email: "test@example.com",
    normalized_phone: "12145551212",
    phone_last_four: "1212",
    source: "facebook_lead_ad",
    facebook_page_id: null,
    facebook_form_id: null,
    facebook_campaign_id: null,
    facebook_ad_id: null,
    submitted_at: BASE_TIME.toISOString(),
    received_at: BASE_TIME.toISOString(),
    claimed_at: null,
    claimed_by_activation_id: null,
    matched_lead_id: null,
    created_at: BASE_TIME.toISOString(),
    updated_at: BASE_TIME.toISOString(),
    ...overrides,
  };
}

function criteria(overrides: Partial<ActivationCriteria> = {}): ActivationCriteria {
  return {
    brandSlug: "cmdt",
    source: "facebook_lead_ad",
    facebookPageId: null,
    facebookFormId: null,
    facebookCampaignId: null,
    facebookAdId: null,
    ...overrides,
  };
}

const WINDOW = computeMatchWindow(BASE_TIME, 120, 30);

describe("computeMatchWindow", () => {
  it("spans before/after seconds around the activation's creation time", () => {
    const window = computeMatchWindow(BASE_TIME, 120, 30);
    expect(window.startMs).toBe(BASE_TIME.getTime() - 120_000);
    expect(window.endMs).toBe(BASE_TIME.getTime() + 30_000);
  });
});

describe("selectEligibleCandidates", () => {
  it("excludes claimed, wrong-brand, and out-of-window leads", () => {
    const leads = [
      lead({ id: "eligible" }),
      lead({ id: "claimed", claimed_at: BASE_TIME.toISOString() }),
      lead({ id: "wrong-brand", brand_slug: "other" }),
      lead({ id: "too-early", received_at: new Date(BASE_TIME.getTime() - 200_000).toISOString() }),
      lead({ id: "too-late", received_at: new Date(BASE_TIME.getTime() + 60_000).toISOString() }),
    ];
    const eligible = selectEligibleCandidates(leads, criteria(), WINDOW);
    expect(eligible.map((l) => l.id)).toEqual(["eligible"]);
  });
});

describe("classifyAutoMatch", () => {
  it("matches a single unique candidate via brand + source + time (tier 3)", () => {
    const leads = [lead({ id: "only" })];
    const result = classifyAutoMatch(selectEligibleCandidates(leads, criteria(), WINDOW), criteria());
    expect(result.outcome).toBe("matched");
    if (result.outcome === "matched") {
      expect(result.candidate.id).toBe("only");
      expect(result.tier).toBe("brand_source_time");
    }
  });

  it("never guesses: multiple plausible leads is ambiguous, not a pick", () => {
    const leads = [lead({ id: "a" }), lead({ id: "b" })];
    const result = classifyAutoMatch(selectEligibleCandidates(leads, criteria(), WINDOW), criteria());
    expect(result.outcome).toBe("ambiguous");
    if (result.outcome === "ambiguous") {
      expect(result.candidates).toHaveLength(2);
    }
  });

  it("returns no_match when nothing is eligible yet", () => {
    const result = classifyAutoMatch([], criteria());
    expect(result.outcome).toBe("no_match");
  });

  it("prefers form + campaign context over a looser brand/source match", () => {
    const leads = [
      lead({ id: "form-and-campaign", facebook_form_id: "form-1", facebook_campaign_id: "camp-1" }),
      lead({ id: "form-only-no-campaign", facebook_form_id: "form-1" }),
    ];
    const eligible = selectEligibleCandidates(
      leads,
      criteria({ facebookFormId: "form-1", facebookCampaignId: "camp-1" }),
      WINDOW,
    );
    const result = classifyAutoMatch(
      eligible,
      criteria({ facebookFormId: "form-1", facebookCampaignId: "camp-1" }),
    );
    expect(result.outcome).toBe("matched");
    if (result.outcome === "matched") {
      expect(result.candidate.id).toBe("form-and-campaign");
      expect(result.tier).toBe("form_context");
    }
  });

  it("falls through to form-only when form+context tier finds nothing", () => {
    const leads = [lead({ id: "form-only", facebook_form_id: "form-1" })];
    const eligible = selectEligibleCandidates(
      leads,
      criteria({ facebookFormId: "form-1", facebookCampaignId: "camp-does-not-match" }),
      WINDOW,
    );
    const result = classifyAutoMatch(
      eligible,
      criteria({ facebookFormId: "form-1", facebookCampaignId: "camp-does-not-match" }),
    );
    expect(result.outcome).toBe("matched");
    if (result.outcome === "matched") expect(result.tier).toBe("form_only");
  });

  it("does not fall through to a broader tier once the specific tier is ambiguous", () => {
    const leads = [
      lead({ id: "a", facebook_form_id: "form-1" }),
      lead({ id: "b", facebook_form_id: "form-1" }),
    ];
    const eligible = selectEligibleCandidates(leads, criteria({ facebookFormId: "form-1" }), WINDOW);
    const result = classifyAutoMatch(eligible, criteria({ facebookFormId: "form-1" }));
    expect(result.outcome).toBe("ambiguous");
    if (result.outcome === "ambiguous") expect(result.tier).toBe("form_only");
  });
});

describe("classifyLastFourMatch", () => {
  it("resolves a unique match on last four digits", () => {
    const leads = [
      lead({ id: "match", phone_last_four: "4821" }),
      lead({ id: "other", phone_last_four: "9999" }),
    ];
    const result = classifyLastFourMatch(leads, criteria(), "4821", WINDOW);
    expect(result.outcome).toBe("matched");
    if (result.outcome === "matched") expect(result.candidate.id).toBe("match");
  });

  it("stays ambiguous when last four still matches more than one lead", () => {
    const leads = [lead({ id: "a", phone_last_four: "4821" }), lead({ id: "b", phone_last_four: "4821" })];
    const result = classifyLastFourMatch(leads, criteria(), "4821", WINDOW);
    expect(result.outcome).toBe("ambiguous");
    if (result.outcome === "ambiguous") expect(result.count).toBe(2);
  });

  it("reports no_match without revealing anything when digits don't match", () => {
    const leads = [lead({ id: "a", phone_last_four: "0000" })];
    const result = classifyLastFourMatch(leads, criteria(), "4821", WINDOW);
    expect(result.outcome).toBe("no_match");
  });
});
