import { cn } from "@/lib/utils";
import { SIGNAL } from "@/lib/advisor/discoveryStages";
import type { InvestorRow } from "@/lib/advisor/investors";
import type { QualificationResultValue } from "@/types/lead";

/**
 * Shared row helpers for both the List and Board views of the Questionnaires
 * page, so the two presentations never disagree about what "qualified" or
 * "submitted" means for a given row.
 */

export function submittedAtFor(row: InvestorRow): string | null {
  return row.lead.questionnaire_completed_at ?? row.questionnaire?.created_at ?? null;
}

export interface Verdict {
  color: string;
  tint: string;
  label: string;
}

export function verdictFor(row: InvestorRow): Verdict {
  const qualified = row.lead.qualification_result === "qualified";
  return qualified
    ? { color: SIGNAL.success, tint: SIGNAL.successTint, label: "Qualified" }
    : { color: SIGNAL.warning, tint: SIGNAL.warningTint, label: "Review required" };
}

/**
 * Where a row sits in the post-questionnaire triage flow — the Board view's
 * columns. Qualification comes first: a row flagged for review belongs
 * there regardless of any appointment activity, since that's the more
 * urgent thing for the advisor to look at.
 */
export type TriageStage = "needs_review" | "ready_to_schedule" | "scheduled" | "completed";

/**
 * `qualificationOverride` lets the Board view compute a row's column
 * against an in-flight drag before the server confirms it — everything
 * else about the row (appointments) is unaffected by qualification.
 */
export function triageStageFor(
  row: InvestorRow,
  qualificationOverride?: QualificationResultValue,
): TriageStage {
  const qualification = qualificationOverride ?? row.lead.qualification_result;
  if (qualification !== "qualified") return "needs_review";
  if (row.activeAppointment) return "scheduled";
  if (row.appointments.some((appointment) => appointment.status === "COMPLETED")) return "completed";
  return "ready_to_schedule";
}

/**
 * Only the qualification split is a real, single-field toggle a drag can
 * safely represent — "Scheduled" and "Completed" are facts about a real
 * appointment, and a drag can't fabricate one of those. So only cards
 * sitting in these two columns can be picked up, and only these two
 * columns accept a drop.
 */
export const DRAGGABLE_STAGES: ReadonlySet<TriageStage> = new Set([
  "needs_review",
  "ready_to_schedule",
]);

export function qualificationResultForStage(
  stage: "needs_review" | "ready_to_schedule",
): QualificationResultValue {
  return stage === "ready_to_schedule" ? "qualified" : "review_required";
}

/**
 * A questionnaire answer that may never have been collected. An unanswered
 * question is ghosted as "Not provided" rather than shown as an em dash — the
 * distinction between "we didn't ask" and "they declined" matters when an
 * advisor is deciding whether to chase it.
 */
export function Answer({ value, className }: { value: string; className?: string }) {
  const missing = !value || value === "—" || value === "Not Provided";
  return (
    <span
      className={cn(
        "truncate text-[12.5px]",
        missing ? "font-medium text-ghost-foreground" : "font-semibold text-secondary-foreground",
        className,
      )}
    >
      {missing ? "Not provided" : value}
    </span>
  );
}
