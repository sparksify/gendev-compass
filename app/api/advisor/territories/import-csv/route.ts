import { NextResponse } from "next/server";
import { sameOriginOk } from "@/lib/advisor/auth";
import { requireAdminApi } from "@/lib/advisor/requireAdmin";
import { getStore } from "@/lib/store";
import { parseTerritoryCsv, type CsvRow } from "@/lib/territory/csv";
import type { TerritoryStatus } from "@/types/territory";

export const dynamic = "force-dynamic";

interface RowError {
  row: number;
  errors: string[];
}

/**
 * Bulk territory + ZIP-code import from CSV (see docs/territory-advisor.md
 * for the template). Validates every row before committing anything for
 * that row's territory group; partial success is reported per row so staff
 * can fix and re-upload just the bad rows.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!sameOriginOk(request)) {
    return NextResponse.json({ success: false, error: "Invalid origin" }, { status: 403 });
  }
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const csv = typeof (body as { csv?: unknown })?.csv === "string" ? (body as { csv: string }).csv : null;
  if (!csv || csv.trim().length === 0) {
    return NextResponse.json({ success: false, error: "No CSV content provided" }, { status: 400 });
  }

  const parsedRows = parseTerritoryCsv(csv);
  const rowErrors: RowError[] = parsedRows.filter((r) => r.errors.length > 0).map((r) => ({ row: r.row, errors: r.errors }));
  const validRows = parsedRows.filter((r): r is { row: number; data: CsvRow; errors: string[] } => r.data != null);

  const store = getStore();
  const brandCache = new Map<string, string | null>(); // slug -> brandId | null (not found)

  type Group = { brandId: string; territory_name: string; territory_code: string; status: string; public_display_level: string; internal_notes: string; zips: Set<string>; rows: number[] };
  const groups = new Map<string, Group>();

  for (const { row, data } of validRows) {
    let brandId = brandCache.get(data.brand_identifier);
    if (brandId === undefined) {
      const brand = await store.getBrandBySlug(data.brand_identifier);
      brandId = brand?.id ?? null;
      brandCache.set(data.brand_identifier, brandId);
    }
    if (!brandId) {
      rowErrors.push({ row, errors: [`Unknown brand_identifier "${data.brand_identifier}"`] });
      continue;
    }

    const groupKey = `${brandId}::${data.territory_code || data.territory_name}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        brandId,
        territory_name: data.territory_name,
        territory_code: data.territory_code,
        status: data.status,
        public_display_level: data.public_display_level,
        internal_notes: data.internal_notes,
        zips: new Set(),
        rows: [],
      };
      groups.set(groupKey, group);
    }
    group.zips.add(data.zip_code);
    group.rows.push(row);
  }

  let createdTerritories = 0;
  let reusedTerritories = 0;
  let zipsAdded = 0;

  for (const group of groups.values()) {
    try {
      const existing = (await store.listTerritoryDefinitions(group.brandId)).find(
        (t) =>
          (group.territory_code && t.territory_code === group.territory_code) ||
          (!group.territory_code && t.territory_name === group.territory_name),
      );
      const territory =
        existing ??
        (await store.createTerritoryDefinition({
          brand_id: group.brandId,
          territory_name: group.territory_name,
          territory_code: group.territory_code || null,
          definition_type: "zip_list",
          status: group.status as TerritoryStatus,
          public_display_level: group.public_display_level as "hidden" | "generalized" | "exact",
          internal_notes: group.internal_notes || null,
        }));
      if (existing) reusedTerritories++;
      else createdTerritories++;

      const added = await store.addTerritoryZipCodes(territory.id, [...group.zips]);
      zipsAdded += added.length;
    } catch (error) {
      console.error("[advisor/territories/import-csv] group failed:", error);
      for (const row of group.rows) {
        rowErrors.push({ row, errors: ["Could not save this territory/ZIP — see server logs"] });
      }
    }
  }

  return NextResponse.json({
    success: true,
    summary: { createdTerritories, reusedTerritories, zipsAdded, totalRows: parsedRows.length, failedRows: rowErrors.length },
    rowErrors: rowErrors.sort((a, b) => a.row - b.row),
  });
}
