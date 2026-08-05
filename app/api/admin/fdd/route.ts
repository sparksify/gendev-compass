import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminTestPassword, isProduction } from "@/lib/config/env";
import { getStore } from "@/lib/store";
import { isGhlConfigured, getFddWebhookSecret, getFddWaitingPeriodDays } from "@/lib/config/fdd";
import { requestFdd, effectiveFddStatus } from "@/lib/fdd/workflow";
import { clientIpFrom } from "@/lib/rateLimit";
import type { LeadRecord } from "@/types/lead";

export const dynamic = "force-dynamic";

/** Same auth model as the asset admin: header password, required in production. */
function authorized(request: Request): boolean {
  const adminPassword = getAdminTestPassword();
  const provided = request.headers.get("x-admin-password");
  if (adminPassword) return provided === adminPassword;
  return !isProduction();
}

function summarizeLead(lead: LeadRecord) {
  return {
    id: lead.id,
    name: `${lead.first_name} ${lead.last_name}`,
    email: lead.email,
    fdd_status: lead.fdd_status,
    fdd_effective_status: effectiveFddStatus(lead),
    fdd_requested_at: lead.fdd_requested_at,
    fdd_sent_at: lead.fdd_sent_at,
    fdd_delivered_at: lead.fdd_delivered_at,
    fdd_received_at: lead.fdd_received_at,
    fdd_eligible_at: lead.fdd_eligible_at,
    fdd_provider_envelope_id: lead.fdd_provider_envelope_id,
    fdd_workflow_id: lead.fdd_workflow_id,
    fdd_request_source: lead.fdd_request_source,
    fdd_last_error: lead.fdd_last_error,
    fdd_retry_count: lead.fdd_retry_count,
  };
}

/**
 * Admin FDD dashboard data: every lead in the workflow, integration health,
 * and (with ?leadId=) the full audit timeline for one prospect.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const store = getStore();
  const leadId = new URL(request.url).searchParams.get("leadId");

  if (leadId) {
    const lead = await store.getLeadById(leadId);
    if (!lead) {
      return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
    }
    const timeline = await store.listFddAudit(leadId);
    return NextResponse.json({ success: true, lead: summarizeLead(lead), timeline });
  }

  const leads = await store.listFddLeads();
  return NextResponse.json({
    success: true,
    leads: leads.map(summarizeLead),
    config: {
      ghlConfigured: isGhlConfigured(),
      webhookSecretConfigured: Boolean(getFddWebhookSecret()),
      waitingPeriodDays: getFddWaitingPeriodDays(),
    },
  });
}

const adminActionSchema = z.object({
  action: z.enum(["resend", "mark_manual_review"]),
  leadId: z.string().min(1),
  /** Manual corrections always require a recorded reason. */
  reason: z.string().trim().max(1000).optional(),
});

/**
 * Admin actions: resend/retry a failed or stuck request, or flag a record
 * for manual review. Every action lands in the audit log with the actor.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }

  const store = getStore();
  const lead = await store.getLeadById(parsed.data.leadId);
  if (!lead) {
    return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
  }

  if (parsed.data.action === "mark_manual_review") {
    if (!parsed.data.reason) {
      return NextResponse.json(
        { success: false, error: "A reason is required to mark a record for manual review." },
        { status: 400 },
      );
    }
    const updated = await store.updateLead(lead.id, {
      fdd_status: "error_manual_review",
      fdd_last_error: parsed.data.reason,
    });
    await store.insertFddAudit({
      lead_id: lead.id,
      event: "fdd_marked_for_manual_review",
      source: "admin_dashboard",
      actor: "admin",
      ip_address: clientIpFrom(request),
      before_values: { fdd_status: lead.fdd_status },
      after_values: { fdd_status: "error_manual_review", reason: parsed.data.reason },
    });
    return NextResponse.json({ success: true, lead: summarizeLead(updated) });
  }

  const result = await requestFdd(
    lead,
    { source: "admin_resend", actor: "admin", ip: clientIpFrom(request) },
    { force: true },
  );
  return NextResponse.json({
    success: result.ok,
    error: result.error,
    lead: summarizeLead(result.lead),
  });
}
