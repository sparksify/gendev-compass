import {
  DISCOVERY_STAGES,
  discoveryStageIdFor,
  SIGNAL,
  type DiscoveryStageId,
} from "@/lib/advisor/discoveryStages";
import type { InvestorRow } from "@/lib/advisor/investors";
import type { InvestorStage } from "@/types/advisor";

/**
 * Every next action wears its own color, so both the List and the Board
 * read at a glance: the hot reds/ambers are outreach owed, the cool hues
 * are process moving along. Unknown strings fall back to the neutral chip;
 * "—" stays plain.
 */
const ACTION_BUBBLES: Record<string, { color: string; tint: string }> = {
  "Schedule follow-up": { color: SIGNAL.alert, tint: SIGNAL.alertTint },
  "Rebook cancelled consultation": { color: "#be123c", tint: "#fff1f2" },
  "Resolve FDD delivery error": { color: "#c2410c", tint: "#fff7ed" },
  "Encourage questionnaire completion": { color: SIGNAL.warning, tint: SIGNAL.warningTint },
  "Follow up on FDD": { color: "#6d28d9", tint: "#f5f3ff" },
  "Prepare for consultation": { color: "#2463eb", tint: "#eff4ff" },
  "Review outcome and update stage": { color: "#4f46e5", tint: "#eef2ff" },
  "Begin due diligence discussion": { color: "#0e7490", tint: "#f0fafb" },
  "Discuss the franchise agreement": { color: "#047857", tint: "#ecfdf5" },
  "Await portal activity": { color: "#0e7490", tint: "#f0fafb" },
  "Monitor engagement": { color: SIGNAL.success, tint: SIGNAL.successTint },
};

export function actionBubble(row: InvestorRow): { color: string; tint: string } {
  return ACTION_BUBBLES[row.nextAction] ?? { color: SIGNAL.neutral, tint: SIGNAL.neutralTint };
}

/**
 * The Board's columns: the same five discovery stages the filter chips and
 * the Overview pipeline chart already use, plus one more for clients who've
 * left the process. `entryStage` is the granular stage a manual drag into
 * that column actually sets — discovery stages are a many-to-one projection
 * over the granular ones, so a drag needs a single representative target.
 */
export type BoardColumnId = DiscoveryStageId | "not_a_fit";

export interface BoardColumn {
  id: BoardColumnId;
  title: string;
  color: string;
  tint: string;
  entryStage: InvestorStage;
}

export const BOARD_COLUMNS: BoardColumn[] = [
  ...DISCOVERY_STAGES.map((stage) => ({
    id: stage.id,
    title: stage.short,
    color: stage.color,
    tint: stage.tint,
    entryStage: stage.entryStage,
  })),
  {
    id: "not_a_fit",
    title: "Not a Fit",
    color: SIGNAL.neutral,
    tint: SIGNAL.neutralTint,
    entryStage: "NOT_A_FIT",
  },
];

/**
 * `stageOverride` lets the Board compute a card's column against an
 * in-flight drag before the server confirms it.
 */
export function boardColumnFor(stage: string, stageOverride?: InvestorStage): BoardColumnId {
  const effective = stageOverride ?? stage;
  return discoveryStageIdFor(effective) ?? "not_a_fit";
}
