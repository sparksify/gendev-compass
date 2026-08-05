/**
 * zip_code_reference holds ~41k rows nationwide — well past PostgREST's
 * default per-request row cap (1,000) — so listZipCodeReferences must page
 * through with .range() instead of issuing one unbounded .select(). A
 * silent truncation here previously meant most of the country was invisible
 * to geocoding/nearby-ZIP lookups and the Census demographics matcher, even
 * though the underlying table had the data. This test mocks the Supabase
 * client to simulate the cap and verifies every row still comes back.
 */
import { describe, expect, it } from "vitest";
import { vi } from "vitest";

const TOTAL_ROWS = 2500;
const allRows = Array.from({ length: TOTAL_ROWS }, (_, i) => ({
  zip_code: String(10000 + i),
  city: "Test City",
  state_code: "TX",
  county_name: null,
  latitude: 30,
  longitude: -97,
  population: null,
  households: null,
  median_household_income: null,
  timezone: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  population_growth_pct: null,
  demographics_source: null,
  demographics_vintage: null,
}));

const rangeCalls: Array<[number, number]> = [];

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table !== "zip_code_reference") throw new Error(`Unexpected table ${table}`);
      return {
        select: () => ({
          // Mirrors PostgREST: only ever returns up to the page size
          // requested by the range, however many rows actually exist.
          range: async (from: number, to: number) => {
            rangeCalls.push([from, to]);
            return { data: allRows.slice(from, to + 1), error: null };
          },
        }),
      };
    },
  }),
}));

describe("supabaseStore.listZipCodeReferences pagination", () => {
  it("pages past PostgREST's default 1,000-row cap and returns every row", async () => {
    const { createSupabaseStore } = await import("@/lib/store/supabaseStore");
    const store = createSupabaseStore();

    const rows = await store.listZipCodeReferences();

    expect(rows).toHaveLength(TOTAL_ROWS);
    expect(rows[0].zip_code).toBe("10000");
    expect(rows[TOTAL_ROWS - 1].zip_code).toBe(String(10000 + TOTAL_ROWS - 1));
    // 2,500 rows at 1,000/page: [0,999], [1000,1999], [2000,2999] (the last
    // page comes back short — 500 rows — which is what stops the loop).
    expect(rangeCalls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });
});
