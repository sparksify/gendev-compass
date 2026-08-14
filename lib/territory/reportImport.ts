/**
 * Parses the "Territory Demographic Report" PDF exported by the team's
 * mapping software (GbBIS) — the document staff upload via the admin
 * "Upload Territory Report" flow to mark a territory reserved, pending
 * sale, sold, etc. See app/api/advisor/territories/reports/parse for how
 * this is used.
 *
 * The report's ZIP table renders one line per row, e.g.
 *   "85006Phoenix24,1156,074"  (ZIP + city + population + density, no
 *   separators between fields in the extracted text)
 * so this only ever trusts the leading 5-digit ZIP code on each line —
 * never the city name or the population/density figures, which this app
 * already sources independently from Census (see lib/geocoding/censusImport.ts)
 * and has no reason to trust a third-party report for. City/state shown in
 * the upload preview come from our own zip_code_reference, not this file.
 */
// Imported from the package's inner module, not "pdf-parse" itself: the
// package root (index.js) runs a debug-mode self-test on import
// (`if (!module.parent) { ...read ./test/data/05-versions-space.pdf... }`)
// that misfires under webpack's module bundling — `module.parent` isn't
// what it expects there — and breaks `next build`'s page-data collection
// with an ENOENT for that fixture file. The inner module has no such
// top-level side effect. Typed by types/pdf-parse-lib.d.ts.
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export interface ParsedTerritoryReport {
  territoryName: string | null;
  zipCodes: string[];
  warnings: string[];
}

const ZIP_TABLE_HEADER = /ZIP\s*Code[^\n]*Name[^\n]*Population/i;
const TERRITORY_NAME_PATTERN = /Territory\s*Name:\s*([^\n]+)/i;
const TERRITORY_FALLBACK_PATTERN = /\bTerritory:\s*([^\n]+)/i;

export async function parseTerritoryReportPdf(buffer: Buffer): Promise<ParsedTerritoryReport> {
  const warnings: string[] = [];

  let text: string;
  try {
    const result = await pdfParse(buffer);
    text = result.text ?? "";
  } catch {
    throw new Error("Could not read this PDF — it may be corrupted or not a real PDF file.");
  }

  const nameMatch = text.match(TERRITORY_NAME_PATTERN) ?? text.match(TERRITORY_FALLBACK_PATTERN);
  const territoryName = nameMatch ? nameMatch[1].trim() : null;
  if (!territoryName) {
    warnings.push("Could not find a territory name in this report — enter one before saving.");
  }

  // Scope the ZIP search to the table itself (after the header row, before
  // the TOTAL line) so nothing outside it — dates, page counts, phone
  // numbers — is ever mistaken for a ZIP code. Falls back to the whole
  // document if the expected header isn't found, since a "0 ZIPs found"
  // result is more actionable for the admin than a hard parse failure.
  const headerMatch = text.match(ZIP_TABLE_HEADER);
  const startIndex = headerMatch ? headerMatch.index! + headerMatch[0].length : 0;
  const totalIndex = text.indexOf("TOTAL", startIndex);
  const tableText = text.slice(startIndex, totalIndex !== -1 ? totalIndex : undefined);

  const seen = new Set<string>();
  const zipCodes: string[] = [];
  for (const rawLine of tableText.split("\n")) {
    const line = rawLine.trim();
    const zip = line.match(/^\d{5}/)?.[0];
    if (zip && !seen.has(zip)) {
      seen.add(zip);
      zipCodes.push(zip);
    }
  }
  if (zipCodes.length === 0) {
    warnings.push("No ZIP codes were found in this report.");
  }

  return { territoryName, zipCodes, warnings };
}
