import { INVESTOR_STAGES, type InvestorStage } from "@/types/advisor";

/**
 * The five-stage discovery process the business actually runs, laid over the
 * thirteen granular `INVESTOR_STAGES` the system keeps internally. Nothing is
 * stored against this model — it is a pure projection, so automation, the
 * audit trail, and the API all keep working on the granular stages while the
 * advisor UI speaks the language the team uses out loud.
 *
 * Color is the second half of every label, never the whole signal: each stage
 * owns one muted hue plus a tint, and both always appear next to the stage
 * name (handoff: "pair color with a label, never color alone").
 */
export type DiscoveryStageId = 1 | 2 | 3 | 4 | 5;

export interface DiscoveryStage {
  id: DiscoveryStageId;
  /** Full name, e.g. "FDD Review & Territory Mapping". */
  name: string;
  /** Table/chip name, e.g. "FDD & Territory". */
  short: string;
  /** Pipeline-label name under the funnel, e.g. "Invite". */
  tiny: string;
  /** Solid hue — chips, funnel segments, queue spines. */
  color: string;
  /** Tint background paired with the solid hue. */
  tint: string;
  /** The granular stage set on a manual jump to this discovery stage. */
  entryStage: InvestorStage;
}

export const DISCOVERY_STAGES: readonly DiscoveryStage[] = [
  {
    id: 1,
    name: "Intro Call",
    short: "Intro Call",
    tiny: "Intro Call",
    color: "#0e7490",
    tint: "#f0fafb",
    entryStage: "NEW_LEAD",
  },
  {
    id: 2,
    name: "Unit Economics",
    short: "Unit Economics",
    tiny: "Unit Economics",
    color: "#2463eb",
    tint: "#eff4ff",
    entryStage: "QUESTIONNAIRE_COMPLETED",
  },
  {
    id: 3,
    name: "FDD Review & Territory Mapping",
    short: "FDD & Territory",
    tiny: "FDD & Territory",
    color: "#6d28d9",
    tint: "#f5f3ff",
    entryStage: "FDD_SENT",
  },
  {
    id: 4,
    name: "Confirmation Day Invite",
    short: "Confirmation Invite",
    tiny: "Invite",
    color: "#b45309",
    tint: "#fffaeb",
    entryStage: "DUE_DILIGENCE",
  },
  {
    id: 5,
    name: "Confirmation Day Commitment",
    short: "Commitment",
    tiny: "Commitment",
    color: "#15803d",
    tint: "#f0fdf4",
    entryStage: "CLOSED_INVESTED",
  },
] as const;

/** Semantic colors that sit outside the stage spectrum. */
export const SIGNAL = {
  alert: "#b42318",
  alertTint: "#fef3f2",
  success: "#15803d",
  successTint: "#f0fdf4",
  warning: "#b45309",
  warningTint: "#fffaeb",
  /** Neutral chip/pill fill for "no stage" and restricted states. */
  neutral: "#667085",
  neutralTint: "#f2f3f6",
  track: "#f2f3f6",
  rule: "#ececf0",
  ghost: "#c6cbd4",
} as const;

const STAGE_MAP: Record<InvestorStage, DiscoveryStageId | null> = {
  NEW_LEAD: 1,
  PORTAL_ACTIVE: 1,
  ENGAGED: 1,
  QUESTIONNAIRE_STARTED: 1,
  QUESTIONNAIRE_COMPLETED: 2,
  CONSULTATION_SCHEDULED: 2,
  CONSULTATION_COMPLETED: 2,
  FDD_SENT: 3,
  FDD_ACKNOWLEDGED: 3,
  DUE_DILIGENCE: 4,
  QUALIFIED: 4,
  CLOSED_INVESTED: 5,
  // Not a fit is not a point on the discovery process — it leaves it.
  NOT_A_FIT: null,
};

export function discoveryStageIdFor(stage: string): DiscoveryStageId | null {
  return STAGE_MAP[stage as InvestorStage] ?? null;
}

export function discoveryStageFor(stage: string): DiscoveryStage | null {
  const id = discoveryStageIdFor(stage);
  return id ? DISCOVERY_STAGES[id - 1] : null;
}

export function discoveryStage(id: DiscoveryStageId): DiscoveryStage {
  return DISCOVERY_STAGES[id - 1];
}

/** Every granular stage that projects onto this discovery stage. */
export function granularStagesFor(id: DiscoveryStageId): InvestorStage[] {
  return INVESTOR_STAGES.filter((stage) => STAGE_MAP[stage] === id);
}

/**
 * Presentation label for a lead's stage: the discovery stage name, falling
 * back to "Not a fit" for the one granular stage that leaves the process.
 */
export function stageChipFor(stage: string): { label: string; color: string; tint: string } {
  const discovery = discoveryStageFor(stage);
  if (discovery) return { label: discovery.short, color: discovery.color, tint: discovery.tint };
  return { label: "Not a fit", color: SIGNAL.neutral, tint: SIGNAL.neutralTint };
}
