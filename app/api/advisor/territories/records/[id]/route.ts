import { NextResponse } from "next/server";
import { sameOriginOk } from "@/lib/advisor/auth";
import { requireAdminApi } from "@/lib/advisor/requireAdmin";
import { getStore } from "@/lib/store";
import { territoryDefinitionSchema } from "@/lib/validation/territory";

export const dynamic = "force-dynamic";

/** Update a territory record's fields/status (Territory Records admin). Archiving is a status change, not a delete. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!sameOriginOk(request)) {
    return NextResponse.json({ success: false, error: "Invalid origin" }, { status: 403 });
  }
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = territoryDefinitionSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const store = getStore();
  const existing = await store.getTerritoryDefinition(id);
  if (!existing) {
    return NextResponse.json({ success: false, error: "Territory not found" }, { status: 404 });
  }

  try {
    const record = await store.updateTerritoryDefinition(id, {
      ...(parsed.data.territoryName !== undefined ? { territory_name: parsed.data.territoryName } : {}),
      ...(parsed.data.territoryCode !== undefined ? { territory_code: parsed.data.territoryCode } : {}),
      ...(parsed.data.definitionType !== undefined ? { definition_type: parsed.data.definitionType } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.centerLatitude !== undefined ? { center_latitude: parsed.data.centerLatitude } : {}),
      ...(parsed.data.centerLongitude !== undefined ? { center_longitude: parsed.data.centerLongitude } : {}),
      ...(parsed.data.radiusMiles !== undefined ? { radius_miles: parsed.data.radiusMiles } : {}),
      ...(parsed.data.publicDisplayLevel !== undefined ? { public_display_level: parsed.data.publicDisplayLevel } : {}),
      ...(parsed.data.internalNotes !== undefined ? { internal_notes: parsed.data.internalNotes } : {}),
      ...(parsed.data.awardedAt !== undefined ? { awarded_at: parsed.data.awardedAt } : {}),
      ...(parsed.data.reservedUntil !== undefined ? { reserved_until: parsed.data.reservedUntil } : {}),
    });
    return NextResponse.json({ success: true, territory: record });
  } catch (error) {
    console.error("[advisor/territories/records/:id] failed:", error);
    return NextResponse.json({ success: false, error: "Could not update territory" }, { status: 500 });
  }
}
