import { NextResponse } from "next/server";
import { getAdminTestPassword, isProduction } from "@/lib/config/env";
import { commitSignedAsset, getAssetSlot } from "@/lib/assets";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const adminPassword = getAdminTestPassword();
  const provided = request.headers.get("x-admin-password");
  if (adminPassword) return provided === adminPassword;
  return !isProduction();
}

/** Records a completed direct-to-storage upload after verifying it landed. */
export async function POST(request: Request): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { key?: string; path?: string; filename?: string; contentType?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const slot = typeof body.key === "string" ? getAssetSlot(body.key) : undefined;
  if (
    !slot ||
    typeof body.path !== "string" ||
    !body.path.startsWith(`${slot.key}/`) ||
    typeof body.filename !== "string" ||
    typeof body.contentType !== "string"
  ) {
    return NextResponse.json({ success: false, error: "Invalid commit payload" }, { status: 400 });
  }

  try {
    const asset = await commitSignedAsset({
      key: slot.key,
      path: body.path,
      filename: body.filename,
      contentType: body.contentType,
    });
    return NextResponse.json({ success: true, asset });
  } catch (error) {
    console.error("[admin/assets/commit] failed:", error);
    return NextResponse.json(
      { success: false, error: "Could not record the upload. Please try again." },
      { status: 500 },
    );
  }
}
