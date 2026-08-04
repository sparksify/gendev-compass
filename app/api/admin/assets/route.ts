import { NextResponse } from "next/server";
import { getAdminTestPassword, isProduction, isSupabaseConfigured } from "@/lib/config/env";
import { ASSET_SLOTS, getAssetSlot, getSiteAssets, saveSiteAsset } from "@/lib/assets";

export const dynamic = "force-dynamic";

/**
 * Admin asset management. Same auth model as lead creation: the
 * ADMIN_TEST_PASSWORD is required whenever configured, and in production
 * a missing password rejects every request.
 */
function authorized(request: Request): boolean {
  const adminPassword = getAdminTestPassword();
  const provided = request.headers.get("x-admin-password");
  if (adminPassword) return provided === adminPassword;
  return !isProduction();
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const assets = await getSiteAssets();
  return NextResponse.json({ success: true, slots: ASSET_SLOTS, assets });
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (isProduction() && !isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Supabase storage is not configured" },
      { status: 500 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid form data" }, { status: 400 });
  }

  const key = form.get("key");
  const file = form.get("file");
  if (typeof key !== "string" || !(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: "A slot key and file are required" },
      { status: 400 },
    );
  }

  const slot = getAssetSlot(key);
  if (!slot) {
    return NextResponse.json({ success: false, error: "Unknown asset slot" }, { status: 400 });
  }
  if (!slot.accept.includes(file.type)) {
    return NextResponse.json(
      { success: false, error: `File type must be one of: ${slot.accept.join(", ")}` },
      { status: 400 },
    );
  }
  if (file.size > slot.maxBytes) {
    return NextResponse.json(
      {
        success: false,
        error: `File is too large (max ${Math.round(slot.maxBytes / (1024 * 1024))} MB)`,
      },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const asset = await saveSiteAsset({
      key: slot.key,
      buffer,
      filename: file.name,
      contentType: file.type,
    });
    return NextResponse.json({ success: true, asset });
  } catch (error) {
    console.error("[admin/assets] upload failed:", error);
    return NextResponse.json(
      { success: false, error: "Upload failed. Please try again." },
      { status: 500 },
    );
  }
}
