import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi, sameOriginOk } from "@/lib/advisor/auth";
import { isAdmin } from "@/lib/advisor/access";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

/**
 * Admin-only bulk delete from the clients list. Hard-deletes the leads and
 * every per-lead record; platform-domain clients/opportunities keep their
 * rows with provenance detached (see store.deleteLeads).
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!sameOriginOk(request)) {
    return NextResponse.json({ success: false, error: "Invalid origin" }, { status: 403 });
  }
  const auth = await requireStaffApi();
  if ("response" in auth) return auth.response;
  if (!isAdmin(auth.user)) {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  try {
    const deleted = await getStore().deleteLeads(parsed.data.ids);
    console.info(`[advisor/bulk-delete] ${auth.user.email} deleted ${deleted} lead(s)`);
    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error("[advisor/bulk-delete] failed:", error);
    return NextResponse.json(
      { success: false, error: "Clients could not be deleted" },
      { status: 500 },
    );
  }
}
