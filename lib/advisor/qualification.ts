import { getStore } from "@/lib/store";
import { recordLeadEvent } from "@/lib/domain/activities";
import type { LeadRecord, QualificationResultValue } from "@/types/lead";

/**
 * Manual qualification override by a staff member — dragging a card between
 * the Questionnaires board's "Needs Review" and "Ready to Schedule"
 * columns. The auto-computed score is cleared (a manual call doesn't have
 * one) and a note is appended to the reasons list so the history stays
 * legible; the change is also recorded as an activity event for the audit
 * trail.
 */
export async function setQualificationManually(
  lead: LeadRecord,
  result: QualificationResultValue,
  staffUserId: string,
): Promise<void> {
  if (lead.qualification_result === result) return;

  const previousResult = lead.qualification_result;
  const previousScore = lead.qualification_score;
  const reasons = [
    ...(lead.qualification_reasons ?? []),
    `Manually set to "${result}" by staff (was "${previousResult ?? "none"}")`,
  ];

  const store = getStore();
  await store.updateLead(lead.id, {
    qualification_result: result,
    qualification_score: null,
    qualification_reasons: reasons,
  });

  await recordLeadEvent(
    lead,
    "qualification_overridden",
    { previousResult, previousScore, newResult: result, staffUserId },
    null,
    { source: "staff", staffUserId },
  );
}
