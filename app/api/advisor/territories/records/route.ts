import { NextResponse } from "next/server";
import { z } from "zod";
import { sameOriginOk } from "@/lib/advisor/auth";
import { requireAdminApi } from "@/lib/advisor/requireAdmin";
import { getStore } from "@/lib/store";
import { territoryDefinitionSchema } from "@/lib/validation/territory";

export const dynamic = "force-dynamic";

const createSchema = territoryDefinitionSchema.extend({ brandId: z.string().trim().min(1) });

/** Create a territory record (Territory Records admin). */
export async function POST(request: Request): Promise<NextResponse> {
  if (!sameOriginOk(request)) {
    return NextResponse.json({ success: false, error: "Invalid origin" }, { status: 403 });
  }
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const store = getStore();
  const brand = await store.getBrandById(parsed.data.brandId);
  if (!brand) {
    return NextResponse.json({ success: false, error: "Brand not found" }, { status: 404 });
  }

  try {
    const record = await store.createTerritoryDefinition({
      brand_id: parsed.data.brandId,
      territory_name: parsed.data.territoryName,
      territory_code: parsed.data.territoryCode ?? null,
      definition_type: parsed.data.definitionType,
      status: parsed.data.status,
      center_latitude: parsed.data.centerLatitude ?? null,
      center_longitude: parsed.data.centerLongitude ?? null,
      radius_miles: parsed.data.radiusMiles ?? null,
      public_display_level: parsed.data.publicDisplayLevel ?? "hidden",
      internal_notes: parsed.data.internalNotes ?? null,
      awarded_at: parsed.data.awardedAt ?? null,
      reserved_until: parsed.data.reservedUntil ?? null,
    });
    return NextResponse.json({ success: true, territory: record });
  } catch (error) {
    console.error("[advisor/territories/records] failed:", error);
    return NextResponse.json({ success: false, error: "Could not create territory" }, { status: 500 });
  }
}
