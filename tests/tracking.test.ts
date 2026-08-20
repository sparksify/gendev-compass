import { describe, expect, it } from "vitest";
import { generateEventId } from "@/lib/tracking/eventId";
import { taxonomyFor } from "@/lib/tracking/taxonomy";
import {
  buildFirstTouchFields,
  buildLastTouchPatch,
  hasQualifiedTouch,
  parseAttributionFromUrl,
} from "@/lib/tracking/attribution";
import { hashEmail, hashPhone, hashName } from "@/lib/tracking/metaHash";
import { marketingAllowed } from "@/lib/tracking/consent";

describe("generateEventId", () => {
  it("produces a stable, prefixed, unique ID", () => {
    const a = generateEventId();
    const b = generateEventId();
    expect(a).toMatch(/^evt_[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});

describe("taxonomyFor", () => {
  it("maps appointment_booked to Meta's Schedule at tier 1", () => {
    const entry = taxonomyFor("appointment_booked");
    expect(entry?.tier).toBe(1);
    expect(entry?.metaEventName).toBe("Schedule");
    expect(entry?.metaCapi).toBe(true);
  });

  it("never maps calendar_booking_completed to Meta (avoids double-counting the booking conversion)", () => {
    const entry = taxonomyFor("calendar_booking_completed");
    expect(entry?.metaEventName).toBeNull();
    expect(entry?.metaCapi).toBe(false);
  });

  it("returns null for events outside the coded taxonomy", () => {
    expect(taxonomyFor("note_added")).toBeNull();
  });
});

describe("parseAttributionFromUrl", () => {
  it("extracts UTM params, click IDs, and strips the query string for landing_page", () => {
    const signal = parseAttributionFromUrl(
      "https://portal.example.com/p/abc?utm_source=facebook&utm_campaign=cmdt_hnw&fbclid=abc123",
      { referrer: "https://facebook.com/", fbp: "fb.1.111.222", fbc: "fb.1.111.abc123" },
    );
    expect(signal.utm_source).toBe("facebook");
    expect(signal.utm_campaign).toBe("cmdt_hnw");
    expect(signal.fbclid).toBe("abc123");
    expect(signal.landing_page).toBe("https://portal.example.com/p/abc");
    expect(signal.referrer).toBe("https://facebook.com/");
    expect(signal.fbp).toBe("fb.1.111.222");
  });

  it("returns nulls for a bare URL with no params", () => {
    const signal = parseAttributionFromUrl("https://portal.example.com/p/abc");
    expect(signal.utm_source).toBeNull();
    expect(signal.fbclid).toBeNull();
    expect(hasQualifiedTouch(signal)).toBe(false);
  });

  it("survives a malformed URL without throwing", () => {
    const signal = parseAttributionFromUrl("not a url");
    expect(signal.utm_source).toBeNull();
    expect(signal.landing_page).toBeNull();
  });
});

describe("hasQualifiedTouch", () => {
  it("is true only when a real attribution signal is present", () => {
    const bare = parseAttributionFromUrl("https://portal.example.com/p/abc");
    expect(hasQualifiedTouch(bare)).toBe(false);

    const withUtm = parseAttributionFromUrl("https://portal.example.com/p/abc?utm_source=facebook");
    expect(hasQualifiedTouch(withUtm)).toBe(true);
  });
});

describe("first/last touch field builders", () => {
  it("never leaves the first-touch fields undefined (always explicit null)", () => {
    const signal = parseAttributionFromUrl("https://portal.example.com/p/abc?utm_source=facebook");
    const fields = buildFirstTouchFields(signal, "2026-08-07T00:00:00.000Z");
    expect(fields.first_utm_source).toBe("facebook");
    expect(fields.first_fbclid).toBeNull();
    expect(fields.first_touch_at).toBe("2026-08-07T00:00:00.000Z");
  });

  it("builds a last-touch patch with the same signal shape", () => {
    const signal = parseAttributionFromUrl("https://portal.example.com/p/abc?utm_campaign=reminder");
    const patch = buildLastTouchPatch(signal, "2026-08-08T00:00:00.000Z");
    expect(patch.last_utm_campaign).toBe("reminder");
    expect(patch.last_touch_at).toBe("2026-08-08T00:00:00.000Z");
  });
});

describe("Meta CAPI hashing", () => {
  it("normalizes case/whitespace before hashing so the same person always hashes identically", () => {
    expect(hashEmail("  Test@Example.com ")).toBe(hashEmail("test@example.com"));
    expect(hashPhone("+1 (555) 000-0000")).toBe(hashPhone("15550000000"));
    expect(hashName(" Darko ")).toBe(hashName("darko"));
  });

  it("returns null for empty input rather than hashing an empty string", () => {
    expect(hashEmail(null)).toBeNull();
    expect(hashEmail("")).toBeNull();
    expect(hashPhone(undefined)).toBeNull();
  });
});

describe("marketingAllowed", () => {
  it("always allows marketing tracking when consent isn't required", () => {
    expect(marketingAllowed(false, null, "denied")).toBe(true);
  });

  it("falls back to the configured default when no decision has been made yet", () => {
    expect(marketingAllowed(true, null, "denied")).toBe(false);
    expect(marketingAllowed(true, null, "granted")).toBe(true);
  });

  it("honors an explicit decision over the default", () => {
    expect(
      marketingAllowed(true, { necessary: true, analytics: true, marketing: false, version: "v1" }, "granted"),
    ).toBe(false);
    expect(
      marketingAllowed(true, { necessary: true, analytics: false, marketing: true, version: "v1" }, "denied"),
    ).toBe(true);
  });
});
