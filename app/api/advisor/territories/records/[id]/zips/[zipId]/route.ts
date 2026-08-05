import { NextResponse } from "next/server";
import { sameOriginOk } from "@/lib/advisor/auth";
import { requireAdminApi } from "@/lib/advisor/requireAdmin";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; zipId: string }> },
): Promise<NextResponse> {
  if (!sameOriginOk(request)) {
    return NextResponse.json({ success: false, error: "Invalid origin" }, { status: 403 });
  }
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const { zipId } = await params;

  try {
    await getStore().removeTerritoryZipCode(zipId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[advisor/territories/records/:id/zips/:zipId] failed:", error);
    return NextResponse.json({ success: false, error: "Could not remove ZIP code" }, { status: 500 });
  }
}
