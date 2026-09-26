import { describe, expect, it } from "vitest";
import { defaultAnalyticsFilters, parseAnalyticsFilters } from "@/lib/analytics/report";

const NOW = new Date("2026-09-26T18:30:00.000Z");

describe("analytics report filters", () => {
  it("defaults to an inclusive seven-day lead cohort", () => {
    expect(defaultAnalyticsFilters(NOW)).toMatchObject({
      start: "2026-09-20",
      end: "2026-09-26",
      preset: "last7",
      method: "cohort",
      compare: true,
    });
  });

  it("resolves this-month and last-month presets", () => {
    expect(parseAnalyticsFilters({ range: "thisMonth" }, NOW)).toMatchObject({
      start: "2026-09-01",
      end: "2026-09-26",
    });
    expect(parseAnalyticsFilters({ range: "lastMonth" }, NOW)).toMatchObject({
      start: "2026-08-01",
      end: "2026-08-31",
    });
  });

  it("uses the final query value so an unchecked compare checkbox stays off", () => {
    expect(parseAnalyticsFilters({ compare: ["0"] }, NOW).compare).toBe(false);
    expect(parseAnalyticsFilters({ compare: ["0", "1"] }, NOW).compare).toBe(true);
  });

  it("normalizes reversed custom ranges", () => {
    expect(parseAnalyticsFilters({ range: "custom", start: "2026-09-20", end: "2026-09-10" }, NOW)).toMatchObject({
      start: "2026-09-10",
      end: "2026-09-20",
    });
  });
});
