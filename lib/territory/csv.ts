import { PUBLIC_DISPLAY_LEVELS, TERRITORY_STATUSES } from "@/types/territory";

/**
 * Minimal hand-rolled CSV parser for the territory ZIP-upload template
 * (matches the app's existing convention of hand-rolled CSV in
 * app/api/advisor/export/route.ts rather than a library dependency).
 * Supports quoted fields containing commas; does not support embedded
 * newlines inside quoted fields.
 */

export const CSV_TEMPLATE_HEADER =
  "brand_identifier,territory_name,territory_code,status,zip_code,public_display_level,internal_notes";

export interface CsvRow {
  brand_identifier: string;
  territory_name: string;
  territory_code: string;
  status: string;
  zip_code: string;
  public_display_level: string;
  internal_notes: string;
}

export interface CsvRowResult {
  row: number;
  data: CsvRow | null;
  errors: string[];
}

function parseLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

const EXPECTED_COLUMNS = CSV_TEMPLATE_HEADER.split(",");

export function parseTerritoryCsv(raw: string): CsvRowResult[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const header = parseLine(lines[0]).map((h) => h.toLowerCase());
  const startIndex = header.join(",") === EXPECTED_COLUMNS.join(",") ? 1 : 0;

  const results: CsvRowResult[] = [];
  for (let i = startIndex; i < lines.length; i++) {
    const rowNumber = i + 1;
    const fields = parseLine(lines[i]);
    const errors: string[] = [];
    const [
      brand_identifier = "",
      territory_name = "",
      territory_code = "",
      status = "",
      zip_code = "",
      public_display_level = "hidden",
      internal_notes = "",
    ] = fields;

    if (!brand_identifier) errors.push("brand_identifier is required");
    if (!territory_name) errors.push("territory_name is required");
    if (!status || !(TERRITORY_STATUSES as readonly string[]).includes(status)) {
      errors.push(`status must be one of: ${TERRITORY_STATUSES.join(", ")}`);
    }
    if (!/^\d{5}$/.test(zip_code)) errors.push("zip_code must be 5 digits");
    if (public_display_level && !(PUBLIC_DISPLAY_LEVELS as readonly string[]).includes(public_display_level)) {
      errors.push(`public_display_level must be one of: ${PUBLIC_DISPLAY_LEVELS.join(", ")}`);
    }

    results.push({
      row: rowNumber,
      data:
        errors.length === 0
          ? {
              brand_identifier,
              territory_name,
              territory_code,
              status,
              zip_code,
              public_display_level: public_display_level || "hidden",
              internal_notes,
            }
          : null,
      errors,
    });
  }
  return results;
}
