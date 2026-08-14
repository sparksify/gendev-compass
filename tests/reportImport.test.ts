/**
 * lib/territory/reportImport.ts parses the mapping software's "Territory
 * Demographic Report" PDF. pdf-parse renders each ZIP row as one line with
 * no separators between fields (e.g. "85006Phoenix24,1156,074" — ZIP, city,
 * population, density all run together) — this fixture is the real text
 * pdf-parse extracted from an actual exported report (CMDT - PHX), not a
 * hand-written approximation, so these tests exercise the real format.
 */
import { describe, expect, it, vi } from "vitest";

const REAL_REPORT_TEXT = `

Territory Demographic Report
Territory Name: CMDT - PHX
LegendDate:8/14/2026
Pg 1 of 2

Territory Demographic Report
Territory: CMDT - PHX
© 2026 GbBIS. Questions? Call us at 1-877-447-6277Demographic Source: Applied Geographic Solutions 2026
ZIP CodeZIP Code NamePopulationPopulation Density
85006Phoenix24,1156,074
85008Phoenix58,5046,069
85009Phoenix49,4583,310
85012Phoenix8,2904,064
85013Phoenix23,7726,513
85014Phoenix27,4906,672
85015Phoenix41,7718,239
85016Phoenix37,2604,122
85018Phoenix37,9273,548
85020Phoenix33,8413,658
85021Phoenix39,6815,621
85029Phoenix43,9745,689
85033Phoenix55,1948,845
85034Phoenix9,257735
85037Phoenix60,5186,424
85040Phoenix35,0543,450
85043Phoenix40,2491,860
85051Phoenix44,4917,018
85202Mesa39,1796,084
85204Mesa61,1326,213
85210Mesa39,1795,686
85253Paradise Valley18,7661,005
85257Scottsdale32,1874,692
85281Tempe59,7456,153
85282Tempe49,9354,602
85283Tempe44,2195,036
85287Tempe1,3333,418
85288Tempe15,0384,120
85353Tolleson54,2742,352
TOTAL1,085,8334,196
Pg 2 of 2
`;

const EXPECTED_ZIPS = [
  "85006", "85008", "85009", "85012", "85013", "85014", "85015", "85016",
  "85018", "85020", "85021", "85029", "85033", "85034", "85037", "85040",
  "85043", "85051", "85202", "85204", "85210", "85253", "85257", "85281",
  "85282", "85283", "85287", "85288", "85353",
];

vi.mock("pdf-parse/lib/pdf-parse.js", () => ({
  default: vi.fn(async () => ({ text: REAL_REPORT_TEXT, numpages: 2 })),
}));

describe("parseTerritoryReportPdf", () => {
  it("extracts the territory name and every ZIP code, in order, from a real exported report", async () => {
    const { parseTerritoryReportPdf } = await import("@/lib/territory/reportImport");
    const result = await parseTerritoryReportPdf(Buffer.from("fake-pdf-bytes"));

    expect(result.territoryName).toBe("CMDT - PHX");
    expect(result.zipCodes).toEqual(EXPECTED_ZIPS);
    expect(result.zipCodes).toHaveLength(29);
    expect(result.warnings).toEqual([]);
  });

  it("never mistakes a population or density figure for a ZIP code (regression guard)", async () => {
    const { parseTerritoryReportPdf } = await import("@/lib/territory/reportImport");
    const result = await parseTerritoryReportPdf(Buffer.from("fake-pdf-bytes"));

    // 1,085,833 (total population) and every 4-digit density figure must
    // never appear — the parser only ever trusts the leading 5-digit token
    // on each table row, not any digit run in the surrounding text.
    for (const zip of result.zipCodes) {
      expect(zip).toMatch(/^\d{5}$/);
    }
    expect(result.zipCodes).not.toContain("10858");
    expect(result.zipCodes).not.toContain("83420"); // no fragment of "1,085,833/4,196" is 5 digits, but guard anyway
  });

  it("dedupes a ZIP code that appears twice", async () => {
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as unknown as ReturnType<typeof vi.fn>;
    pdfParse.mockResolvedValueOnce({
      text: `Territory Name: Dup Test\nZIP CodeZIP Code NamePopulationPopulation Density\n75201Dallas1,0001,000\n75201Dallas1,0001,000\nTOTAL2,0002,000`,
      numpages: 1,
    });
    const { parseTerritoryReportPdf } = await import("@/lib/territory/reportImport");
    const result = await parseTerritoryReportPdf(Buffer.from("fake-pdf-bytes"));
    expect(result.zipCodes).toEqual(["75201"]);
  });

  it("warns (without throwing) when no territory name is found", async () => {
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as unknown as ReturnType<typeof vi.fn>;
    pdfParse.mockResolvedValueOnce({
      text: `Some Report\nZIP CodeZIP Code NamePopulationPopulation Density\n75201Dallas1,0001,000\nTOTAL1,0001,000`,
      numpages: 1,
    });
    const { parseTerritoryReportPdf } = await import("@/lib/territory/reportImport");
    const result = await parseTerritoryReportPdf(Buffer.from("fake-pdf-bytes"));
    expect(result.territoryName).toBeNull();
    expect(result.zipCodes).toEqual(["75201"]);
    expect(result.warnings.some((w) => /territory name/i.test(w))).toBe(true);
  });

  it("warns (without throwing) when no ZIP codes are found", async () => {
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as unknown as ReturnType<typeof vi.fn>;
    pdfParse.mockResolvedValueOnce({ text: `Territory Name: Empty Report\nNo table here.`, numpages: 1 });
    const { parseTerritoryReportPdf } = await import("@/lib/territory/reportImport");
    const result = await parseTerritoryReportPdf(Buffer.from("fake-pdf-bytes"));
    expect(result.territoryName).toBe("Empty Report");
    expect(result.zipCodes).toEqual([]);
    expect(result.warnings.some((w) => /no zip codes/i.test(w))).toBe(true);
  });

  it("throws a clear error when the file isn't a readable PDF", async () => {
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as unknown as ReturnType<typeof vi.fn>;
    pdfParse.mockRejectedValueOnce(new Error("bad xref"));
    const { parseTerritoryReportPdf } = await import("@/lib/territory/reportImport");
    await expect(parseTerritoryReportPdf(Buffer.from("not-a-pdf"))).rejects.toThrow(/could not read this pdf/i);
  });
});
