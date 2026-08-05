import { NextResponse } from "next/server";
import { sameOriginOk } from "@/lib/advisor/auth";
import { requireAdminApi } from "@/lib/advisor/requireAdmin";
import { getStore } from "@/lib/store";
import { bulkStateEligibilitySchema } from "@/lib/validation/territory";

export const dynamic = "force-dynamic";

/** Bulk upsert of brand_state_eligibility rows (the State Eligibility admin grid). */
export async function PUT(request: Request): Promise<NextResponse> {
  if (!sameOriginOk(request)) {
    return NextResponse.json({ success: false, error: "Invalid origin" }, { status: 403 });
  }
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const brandId = typeof (body as { brandId?: unknown })?.brandId === "string" ? (body as { brandId: string }).brandId : null;
  if (!brandId) {
    return NextResponse.json({ success: false, error: "brandId is required" }, { status: 400 });
  }
  const parsed = bulkStateEligibilitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const store = getStore();
  const brand = await store.getBrandById(brandId);
  if (!brand) {
    return NextResponse.json({ success: false, error: "Brand not found" }, { status: 404 });
  }

  try {
    const saved = [];
    for (const row of parsed.data.rows) {
      saved.push(
        await store.upsertStateEligibility({
          brand_id: brandId,
          state_code: row.stateCode,
          status: row.status,
          effective_date: row.effectiveDate ?? null,
          expiration_date: row.expirationDate ?? null,
          notes_internal: row.notesInternal ?? null,
        }),
      );
    }
    return NextResponse.json({ success: true, rows: saved });
  } catch (error) {
    console.error("[advisor/territories/eligibility] failed:", error);
    return NextResponse.json({ success: false, error: "Could not save state eligibility" }, { status: 500 });
  }
}
