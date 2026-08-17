import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffAndLead } from "@/lib/advisor/api";
import { getStore } from "@/lib/store";
import { isValidMilestoneStatus, MILESTONES } from "@/lib/advisor/milestones";
import type { LeadPatch } from "@/lib/store/types";
import type { MilestoneKey, ProcessMilestones } from "@/types/lead";

export const dynamic = "force-dynamic";

const milestoneKeys = MILESTONES.map((m) => m.key) as [MilestoneKey, ...MilestoneKey[]];

const detailsSchema = z
  .object({
    territoriesWanted: z.number().int().min(0).max(999).nullable().optional(),
    /** Partial update — only the named milestones change; others are kept. */
    milestones: z
      .record(
        z.enum(milestoneKeys),
        z.object({
          status: z.string().min(1).max(40),
          date: z.string().datetime({ offset: true }).nullable().optional(),
        }),
      )
      .optional(),
    leadType: z.enum(["organic", "broker"]).nullable().optional(),
    brokerName: z.string().max(200).nullable().optional(),
    brokerNetwork: z.string().max(200).nullable().optional(),
    brokerEmail: z.string().max(320).nullable().optional(),
    brokerPhone: z.string().max(40).nullable().optional(),
  })
  .strict();

/** Advisor-entered client detail fields: territories-wanted estimate,
 * process milestones, and lead-source classification. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const resolved = await requireStaffAndLead(request, id);
  if ("response" in resolved) return resolved.response;
  const { lead } = resolved;

  const body = await request.json().catch(() => null);
  const parsed = detailsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }
  const input = parsed.data;

  const patch: LeadPatch = {};
  if (input.territoriesWanted !== undefined) patch.territories_wanted = input.territoriesWanted;
  if (input.leadType !== undefined) patch.lead_type = input.leadType;
  if (input.brokerName !== undefined) patch.broker_name = input.brokerName;
  if (input.brokerNetwork !== undefined) patch.broker_network = input.brokerNetwork;
  if (input.brokerEmail !== undefined) patch.broker_email = input.brokerEmail;
  if (input.brokerPhone !== undefined) patch.broker_phone = input.brokerPhone;

  if (input.milestones) {
    const next: ProcessMilestones = { ...(lead.process_milestones ?? {}) };
    for (const [key, state] of Object.entries(input.milestones)) {
      if (!state) continue;
      if (!isValidMilestoneStatus(key, state.status)) {
        return NextResponse.json(
          { success: false, error: `Invalid status for ${key}` },
          { status: 400 },
        );
      }
      next[key as MilestoneKey] = { status: state.status, date: state.date ?? null };
    }
    patch.process_milestones = next;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: false, error: "Nothing to update" }, { status: 400 });
  }

  try {
    const updated = await getStore().updateLead(lead.id, patch);
    return NextResponse.json({
      success: true,
      territoriesWanted: updated.territories_wanted ?? null,
      milestones: updated.process_milestones ?? {},
    });
  } catch (error) {
    console.error("[advisor/details] failed:", error);
    return NextResponse.json({ success: false, error: "Update failed" }, { status: 500 });
  }
}
