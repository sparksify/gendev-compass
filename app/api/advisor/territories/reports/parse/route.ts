import { NextResponse } from "next/server";
import { sameOriginOk } from "@/lib/advisor/auth";
import { requireAdminApi } from "@/lib/advisor/requireAdmin";
import { getStore } from "@/lib/store";
import { parseTerritoryReportPdf } from "@/lib/territory/reportImport";
import type { TerritoryStatus } from "@/types/territory";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Generous for a text-based, few-page report PDF — well under what the
 *  mapping software actually exports. */
const MAX_BYTES = 15 * 1024 * 1024;

/** Statuses that represent a real claim on a ZIP — used to flag when an
 *  uploaded report's ZIPs already belong to a *different* active
 *  territory, so staff don't silently double-mark a ZIP. "available" and
 *  "archived" territories don't conflict: claiming their ZIPs is exactly
 *  what a new upload is for. */
const CONFLICTING_STATUSES = new Set<TerritoryStatus>(["reserved", "sold", "corporate", "pending", "unavailable"]);

/**
 * Step 1 of "Upload Territory Report": parses the mapping software's
 * Territory Demographic Report PDF and returns a preview — territory name,
 * ZIP codes (enriched with our own city/state reference; see
 * reportImport.ts for why the PDF's own city column isn't trusted), and any
 * ZIPs already claimed by another active territory for this brand. Nothing
 * is written yet — confirmation happens via /reports/confirm, which
 * resubmits the same file alongside whatever the admin edited.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!sameOriginOk(request)) {
    return NextResponse.json({ success: false, error: "Invalid origin" }, { status: 403 });
  }
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const brandId = form?.get("brandId");
  if (!(file instanceof File) || typeof brandId !== "string" || !brandId) {
    return NextResponse.json({ success: false, error: "A PDF file and brand are required" }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ success: false, error: "Please upload a PDF file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ success: false, error: "File is too large (max 15 MB)" }, { status: 400 });
  }

  const store = getStore();
  const brand = await store.getBrandById(brandId);
  if (!brand) {
    return NextResponse.json({ success: false, error: "Brand not found" }, { status: 404 });
  }

  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = await parseTerritoryReportPdf(buffer);
  } catch (error) {
    console.error("[territories/reports/parse] failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Could not read this PDF" },
      { status: 400 },
    );
  }

  const existingTerritories = await store.listTerritoryDefinitions(brandId);
  const normalizedName = (parsed.territoryName ?? "").trim().toLowerCase();

  // ZIP -> which other territory already claims it, if any.
  const conflictByZip = new Map<string, { territoryId: string; territoryName: string; status: TerritoryStatus }>();
  for (const territory of existingTerritories) {
    if (territory.definition_type !== "zip_list" || !CONFLICTING_STATUSES.has(territory.status)) continue;
    // A same-named territory is what this upload will *update*, not
    // conflict with — its own ZIPs re-appearing is expected, not a warning.
    if (normalizedName && territory.territory_name.trim().toLowerCase() === normalizedName) continue;
    const zips = await store.listZipCodesForTerritory(territory.id);
    for (const z of zips) {
      if (conflictByZip.has(z.zip_code)) continue;
      conflictByZip.set(z.zip_code, {
        territoryId: territory.id,
        territoryName: territory.territory_name,
        status: territory.status,
      });
    }
  }

  const zipCodes = await Promise.all(
    parsed.zipCodes.map(async (zipCode) => {
      const ref = await store.getZipCodeReference(zipCode);
      const conflict = conflictByZip.get(zipCode) ?? null;
      return {
        zipCode,
        city: ref?.city ?? null,
        stateCode: ref?.state_code ?? null,
        conflict,
      };
    }),
  );

  return NextResponse.json({
    success: true,
    territoryName: parsed.territoryName,
    zipCodes,
    warnings: parsed.warnings,
  });
}
