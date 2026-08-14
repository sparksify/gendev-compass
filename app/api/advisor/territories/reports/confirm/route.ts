import { NextResponse } from "next/server";
import { sameOriginOk } from "@/lib/advisor/auth";
import { requireAdminApi } from "@/lib/advisor/requireAdmin";
import { getStore } from "@/lib/store";
import { saveTerritoryReportFile } from "@/lib/territory/reportStorage";
import { territoryReportConfirmSchema } from "@/lib/validation/territory";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Step 2 of "Upload Territory Report": creates a territory (or reuses one
 * with a matching territory_code/name — the same convention import-csv
 * uses), attaches whichever ZIP codes the admin confirmed in the preview,
 * and stores the original report PDF as that territory's source document.
 * Re-receives the file (rather than referencing a temp upload from the
 * parse step) so nothing is ever stored for a report the admin cancelled.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!sameOriginOk(request)) {
    return NextResponse.json({ success: false, error: "Invalid origin" }, { status: 403 });
  }
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const payloadRaw = form?.get("payload");
  if (!(file instanceof File) || typeof payloadRaw !== "string") {
    return NextResponse.json({ success: false, error: "Missing the report file or territory details" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ success: false, error: "File is too large (max 15 MB)" }, { status: 400 });
  }

  let payloadJson: unknown;
  try {
    payloadJson = JSON.parse(payloadRaw);
  } catch {
    return NextResponse.json({ success: false, error: "Invalid territory details" }, { status: 400 });
  }
  const parsed = territoryReportConfirmSchema.safeParse(payloadJson);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const payload = parsed.data;

  const store = getStore();
  const brand = await store.getBrandById(payload.brandId);
  if (!brand) {
    return NextResponse.json({ success: false, error: "Brand not found" }, { status: 404 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await saveTerritoryReportFile(buffer, file.name || "territory-report.pdf", file.type || "application/pdf");
    const now = new Date().toISOString();

    const existing = (await store.listTerritoryDefinitions(payload.brandId)).find(
      (t) =>
        (payload.territoryCode && t.territory_code === payload.territoryCode) ||
        (!payload.territoryCode && t.territory_name === payload.territoryName),
    );

    const territory = existing
      ? await store.updateTerritoryDefinition(existing.id, {
          territory_name: payload.territoryName,
          status: payload.status,
          ...(payload.publicDisplayLevel !== undefined ? { public_display_level: payload.publicDisplayLevel } : {}),
          internal_notes: payload.internalNotes ?? null,
          source_document_url: stored.url,
          source_document_filename: stored.filename,
          source_document_uploaded_at: now,
        })
      : await store.createTerritoryDefinition({
          brand_id: payload.brandId,
          territory_name: payload.territoryName,
          territory_code: payload.territoryCode ?? null,
          definition_type: "zip_list",
          status: payload.status,
          public_display_level: payload.publicDisplayLevel ?? "generalized",
          internal_notes: payload.internalNotes ?? null,
          source_document_url: stored.url,
          source_document_filename: stored.filename,
          source_document_uploaded_at: now,
        });

    const added = await store.addTerritoryZipCodes(territory.id, payload.zipCodes);
    return NextResponse.json({ success: true, territory, zipsAdded: added.length, reused: Boolean(existing) });
  } catch (error) {
    console.error("[territories/reports/confirm] failed:", error);
    return NextResponse.json({ success: false, error: "Could not save this territory" }, { status: 500 });
  }
}
