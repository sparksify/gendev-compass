import { NextResponse } from "next/server";
import { isProduction, isSupabaseConfigured } from "@/lib/config/env";
import { readDevAssetFile } from "@/lib/assets";

export const dynamic = "force-dynamic";

/**
 * Development-only asset server for the file-backed upload fallback.
 * In production (and whenever Supabase is configured) assets are served
 * from Supabase storage's public CDN URLs instead.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
): Promise<NextResponse> {
  if (isProduction() || isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { key } = await params;
  const result = await readDevAssetFile(key);
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": result.asset.content_type ?? "application/octet-stream",
      "Cache-Control": "no-store",
    },
  }) as NextResponse;
}
