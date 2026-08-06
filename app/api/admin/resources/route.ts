import { NextResponse } from "next/server";
import { authorizedAdminRequest } from "@/lib/advisor/adminAccess";
import { isProduction, isSupabaseConfigured } from "@/lib/config/env";
import { createResource, listResources } from "@/lib/resources";

export const dynamic = "force-dynamic";

const MAX_BYTES = 150 * 1024 * 1024;

/**
 * Admin resource-library management. Same auth model as asset uploads: the
 * ADMIN_TEST_PASSWORD is required whenever configured, and in production a
 * missing password rejects every request.
 */

export async function GET(request: Request): Promise<NextResponse> {
  if (!(await authorizedAdminRequest(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const resources = await listResources();
  return NextResponse.json({ success: true, resources });
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await authorizedAdminRequest(request))) {
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

  const title = form.get("title");
  const description = form.get("description");
  const file = form.get("file");
  if (typeof title !== "string" || !title.trim() || !(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: "A title and file are required" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { success: false, error: `File is too large (max ${MAX_BYTES / (1024 * 1024)} MB)` },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const resource = await createResource({
      title: title.trim(),
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      buffer,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
    });
    return NextResponse.json({ success: true, resource });
  } catch (error) {
    console.error("[admin/resources] upload failed:", error);
    return NextResponse.json(
      { success: false, error: "Upload failed. Please try again." },
      { status: 500 },
    );
  }
}
