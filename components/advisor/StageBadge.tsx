import { Badge } from "@/components/ui/badge";
import { STAGE_LABELS, type InvestorStage } from "@/types/advisor";
import { cn } from "@/lib/utils";

/** Exported so other stage-aware controls (e.g. the client-detail status
 * dropdown) render with identical colors instead of a second color map. */
export const STAGE_STYLES: Partial<Record<InvestorStage, string>> = {
  NEW_LEAD: "bg-surface text-muted-foreground",
  PORTAL_ACTIVE: "bg-primary-soft text-primary",
  ENGAGED: "bg-primary-soft text-primary",
  QUESTIONNAIRE_STARTED: "bg-primary-soft text-primary",
  QUESTIONNAIRE_COMPLETED: "bg-[#fef3c7] text-[#92400e]",
  CONSULTATION_SCHEDULED: "bg-[#ede9fe] text-[#5b21b6]",
  CONSULTATION_COMPLETED: "bg-[#ede9fe] text-[#5b21b6]",
  FDD_SENT: "bg-[#fef3c7] text-[#92400e]",
  FDD_ACKNOWLEDGED: "bg-success-soft text-success",
  DUE_DILIGENCE: "bg-success-soft text-success",
  QUALIFIED: "bg-success-soft text-success",
  NOT_A_FIT: "bg-[#fee2e2] text-destructive",
  CLOSED_INVESTED: "bg-success text-white",
};

export function StageBadge({ stage, className }: { stage: string; className?: string }) {
  const label = STAGE_LABELS[stage as InvestorStage] ?? stage;
  return (
    <Badge className={cn("whitespace-nowrap", STAGE_STYLES[stage as InvestorStage], className)}>{label}</Badge>
  );
}
