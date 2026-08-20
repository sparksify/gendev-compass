import { NextResponse } from "next/server";
import { isProduction, isSupabaseConfigured } from "@/lib/config/env";
import { requireAdminApi } from "@/lib/advisor/requireAdmin";
import { readDevTerritoryReportFile } from "@/lib/territory/reportStorage";

export const dynamic = "force-dynamic";

/**
 * Development-only file server for the file-backed territory-report upload
 * fallback. In production (and whenever Supabase is configured) reports
 * are served from Supabase storage's public CDN URLs instead. Gated by
 * admin auth even in dev, matching the sensitivity of everything else in
 * the Territory Records admin.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (isProduction() || isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const buffer = await readDevTerritoryReportFile(id);
  if (!buffer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filename = new URL(request.url).searchParams.get("name") ?? "territory-report.pdf";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  }) as NextResponse;
}
