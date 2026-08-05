import { NextResponse } from "next/server";
import { getAdminTestPassword, isProduction, isSupabaseConfigured } from "@/lib/config/env";
import { createSignedAssetUpload, getAssetSlot } from "@/lib/assets";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const adminPassword = getAdminTestPassword();
  const provided = request.headers.get("x-admin-password");
  if (adminPassword) return provided === adminPassword;
  return !isProduction();
}

/**
 * Authorizes a direct-to-storage upload. The browser PUTs the file to the
 * returned signed URL (bypassing the serverless request-size ceiling) and
 * then confirms via /api/admin/assets/commit. Without Supabase (local
 * development) the client falls back to the direct multipart route.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { key?: string; filename?: string; contentType?: string; size?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const slot = typeof body.key === "string" ? getAssetSlot(body.key) : undefined;
  if (!slot) {
    return NextResponse.json({ success: false, error: "Unknown asset slot" }, { status: 400 });
  }
  if (typeof body.contentType !== "string" || !slot.accept.includes(body.contentType)) {
    return NextResponse.json(
      { success: false, error: `File type must be one of: ${slot.accept.join(", ")}` },
      { status: 400 },
    );
  }
  if (typeof body.size !== "number" || body.size <= 0 || body.size > slot.maxBytes) {
    return NextResponse.json(
      {
        success: false,
        error: `File is too large (max ${Math.round(slot.maxBytes / (1024 * 1024))} MB)`,
      },
      { status: 400 },
    );
  }
  if (typeof body.filename !== "string" || !body.filename) {
    return NextResponse.json({ success: false, error: "A filename is required" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    // Local development: the small direct-upload route handles it.
    return NextResponse.json({ success: true, mode: "direct" });
  }

  try {
    const { signedUrl, path } = await createSignedAssetUpload(slot.key, body.filename);
    return NextResponse.json({ success: true, mode: "signed", signedUrl, path });
  } catch (error) {
    console.error("[admin/assets/sign] failed:", error);
    return NextResponse.json(
      { success: false, error: "Could not authorize the upload. Please try again." },
      { status: 500 },
    );
  }
}
