import { NextResponse } from "next/server";
import { requireStaffAndLead } from "@/lib/advisor/api";
import { isAdmin } from "@/lib/advisor/access";
import { runIntelligenceSync } from "@/lib/ghl/intelligence/sync";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Admin-only recovery for a single Compass → HighLevel projection. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const resolved = await requireStaffAndLead(request, id);
  if ("response" in resolved) return resolved.response;
  if (!isAdmin(resolved.user)) {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }

  try {
    const db = getSupabaseAdmin();
    const eventKey = `staff-resync:${crypto.randomUUID()}`;
    const { error: enqueueError } = await db.rpc("compass_enqueue", {
      p_lead_id: resolved.lead.id,
      p_event_key: eventKey,
    });
    if (enqueueError) throw new Error(`Could not enqueue sync: ${enqueueError.message}`);

    const now = new Date().toISOString();
    const { data, error: resetError } = await db
      .from("compass_intelligence_sync")
      .update({
        retry_count: 0,
        last_error: null,
        next_attempt_at: "1970-01-01T00:00:00.000Z",
        lease_token: null,
        lease_until: null,
      })
      .eq("lead_id", resolved.lead.id)
      .or(`lease_until.is.null,lease_until.lt.${now}`)
      .select("lead_id")
      .maybeSingle();
    if (resetError) throw new Error(`Could not prepare sync: ${resetError.message}`);
    if (!data) {
      return NextResponse.json(
        { success: false, error: "A Compass sync is already running for this client" },
        { status: 409 },
      );
    }

    const result = await runIntelligenceSync(1);
    if (!result.enabled) {
      return NextResponse.json({ success: false, error: "Compass sync is disabled" }, { status: 503 });
    }
    if (result.failed || !result.synced) {
      return NextResponse.json(
        { success: false, error: "HighLevel did not accept the sync; the retry remains queued" },
        { status: 502 },
      );
    }
    console.info(`[compass-sync] ${resolved.user.email} resynced lead ${resolved.lead.id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[compass-sync] manual retry for lead ${resolved.lead.id} failed:`, error);
    return NextResponse.json({ success: false, error: "Compass sync could not be started" }, { status: 500 });
  }
}
