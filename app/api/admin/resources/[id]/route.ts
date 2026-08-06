import { NextResponse } from "next/server";
import { authorizedAdminRequest } from "@/lib/advisor/adminAccess";
import { deleteResource, updateResource } from "@/lib/resources";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await authorizedAdminRequest(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  let body: { title?: string; description?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: { title?: string; description?: string | null } = {};
  if (typeof body.title === "string") {
    if (!body.title.trim()) {
      return NextResponse.json({ success: false, error: "Title cannot be empty" }, { status: 400 });
    }
    patch.title = body.title.trim();
  }
  if (body.description !== undefined) {
    patch.description =
      typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  }

  try {
    const resource = await updateResource(id, patch);
    if (!resource) {
      return NextResponse.json({ success: false, error: "Resource not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, resource });
  } catch (error) {
    console.error("[admin/resources] update failed:", error);
    return NextResponse.json({ success: false, error: "Update failed. Please try again." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await authorizedAdminRequest(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const removed = await deleteResource(id);
    if (!removed) {
      return NextResponse.json({ success: false, error: "Resource not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/resources] delete failed:", error);
    return NextResponse.json({ success: false, error: "Delete failed. Please try again." }, { status: 500 });
  }
}
