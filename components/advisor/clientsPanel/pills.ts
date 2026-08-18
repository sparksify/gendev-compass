import { STAGE_LABELS, type InvestorStage } from "@/types/advisor";

/** New-system status pill: tinted bg + tinted 1px border + colored text. */
export type PillTone = "green" | "blue" | "amber" | "purple" | "neutral" | "hot";

export const PILL_CLASS: Record<PillTone, string> = {
  green: "bg-[#eafbf1] border-[#c4ecd4] text-[#16a34a]",
  hot: "bg-[#f2faf5] border-[#cfebd8] text-[#15803d]",
  blue: "bg-[#eff4ff] border-[#b9cffc] text-[#2463eb]",
  amber: "bg-[#fff7e6] border-[#f5e3b5] text-[#b45309]",
  purple: "bg-[#f5f0ff] border-[#e0d2f9] text-[#7c3aed]",
  neutral: "bg-[#f1f5f9] border-[#e2e8f0] text-[#64748b]",
};

const STAGE_TONE: Partial<Record<InvestorStage, PillTone>> = {
  NEW_LEAD: "blue",
  PORTAL_ACTIVE: "blue",
  ENGAGED: "green",
  QUESTIONNAIRE_STARTED: "amber",
  QUESTIONNAIRE_COMPLETED: "amber",
  CONSULTATION_SCHEDULED: "amber",
  CONSULTATION_COMPLETED: "amber",
  FDD_SENT: "amber",
  FDD_ACKNOWLEDGED: "green",
  DUE_DILIGENCE: "green",
  QUALIFIED: "green",
  NOT_A_FIT: "neutral",
  CLOSED_INVESTED: "purple",
};

export function stagePill(stage: string): { label: string; tone: PillTone } {
  return {
    label: STAGE_LABELS[stage as InvestorStage] ?? stage,
    tone: STAGE_TONE[stage as InvestorStage] ?? "neutral",
  };
}
