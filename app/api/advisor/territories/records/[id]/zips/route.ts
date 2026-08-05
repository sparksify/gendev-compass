import { NextResponse } from "next/server";
import { sameOriginOk } from "@/lib/advisor/auth";
import { requireAdminApi } from "@/lib/advisor/requireAdmin";
import { getStore } from "@/lib/store";
import { addZipCodesSchema } from "@/lib/validation/territory";

export const dynamic = "force-dynamic";

/** Add ZIP codes to a zip_list territory (manual paste — see import-csv for bulk file upload). */
export async function POST(
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
  const parsed = addZipCodesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const store = getStore();
  const territory = await store.getTerritoryDefinition(id);
  if (!territory) {
    return NextResponse.json({ success: false, error: "Territory not found" }, { status: 404 });
  }

  try {
    const added = await store.addTerritoryZipCodes(id, parsed.data.zipCodes);
    return NextResponse.json({ success: true, added });
  } catch (error) {
    console.error("[advisor/territories/records/:id/zips] failed:", error);
    return NextResponse.json({ success: false, error: "Could not add ZIP codes" }, { status: 500 });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const zips = await getStore().listZipCodesForTerritory(id);
  return NextResponse.json({ success: true, zips });
}
