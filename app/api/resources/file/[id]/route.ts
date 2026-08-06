import { NextResponse } from "next/server";
import { isProduction, isSupabaseConfigured } from "@/lib/config/env";
import { readDevResourceFile } from "@/lib/resources";

export const dynamic = "force-dynamic";

/**
 * Development-only file server for the file-backed resource upload
 * fallback. In production (and whenever Supabase is configured) resources
 * are served from Supabase storage's public CDN URLs instead.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (isProduction() || isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;
  const result = await readDevResourceFile(id);
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": result.resource.content_type ?? "application/octet-stream",
      "Cache-Control": "no-store",
    },
  }) as NextResponse;
}
