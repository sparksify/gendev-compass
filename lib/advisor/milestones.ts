import type { PillTone } from "@/components/advisor/v3";
import type { MilestoneKey, ProcessMilestones } from "@/types/lead";

/** Pill tone shared by the Client Progress and Process Milestones cards. */
export type MilestoneTone = "neutral" | "amber" | "green";

export interface MilestoneStatusDef {
  value: string;
  label: string;
  tone: MilestoneTone;
  /** Counts toward the "N of 4 complete" derivation. */
  complete?: boolean;
}

export interface MilestoneDef {
  key: MilestoneKey;
  label: string;
  /** First status is the default when the lead has no record yet. */
  statuses: MilestoneStatusDef[];
  /** Whether this milestone carries a date (attended-at / booked-for / signing date). */
  hasDate: boolean;
}

/**
 * The advisor-set steps to close a franchise sale, in the order the handoff
 * lays them out. They are preceded on the page by two rows the advisor does
 * not set — questionnaire submission and the FDD Item 23 receipt — which are
 * derived from the lead record instead (see ProcessMilestonesCard).
 */
export const MILESTONES: MilestoneDef[] = [
  {
    key: "territory_designed",
    label: "Territory designed",
    hasDate: false,
    statuses: [
      { value: "not_started", label: "Not started", tone: "neutral" },
      { value: "in_progress", label: "In progress", tone: "amber" },
      { value: "complete", label: "Complete", tone: "green", complete: true },
    ],
  },
  {
    key: "ops_zoom_call",
    label: "Ops Zoom call",
    hasDate: true,
    statuses: [
      { value: "not_booked", label: "Not booked", tone: "neutral" },
      { value: "booked", label: "Booked", tone: "amber" },
      { value: "attended", label: "Attended", tone: "green", complete: true },
    ],
  },
  {
    key: "founder_intro_call",
    label: "Founder intro call",
    hasDate: true,
    statuses: [
      { value: "not_booked", label: "Not booked", tone: "neutral" },
      { value: "booked", label: "Booked", tone: "amber" },
      { value: "completed", label: "Completed", tone: "green", complete: true },
    ],
  },
  {
    key: "signing_day",
    label: "Signing day",
    hasDate: true,
    statuses: [
      { value: "not_set", label: "Not set", tone: "neutral" },
      { value: "scheduled", label: "Scheduled", tone: "amber" },
      { value: "signed", label: "Signed", tone: "green", complete: true },
    ],
  },
];

export function milestoneStatus(milestones: ProcessMilestones | null | undefined, def: MilestoneDef): MilestoneStatusDef {
  const raw = milestones?.[def.key]?.status;
  return def.statuses.find((s) => s.value === raw) ?? def.statuses[0];
}

export function completeCount(milestones: ProcessMilestones | null | undefined): number {
  return MILESTONES.filter((def) => milestoneStatus(milestones, def).complete).length;
}

export function isValidMilestoneStatus(key: string, status: string): boolean {
  const def = MILESTONES.find((d) => d.key === key);
  return Boolean(def?.statuses.some((s) => s.value === status));
}

/** Shared pill tone for milestone/progress statuses (v3 semantic tones). */
export const TONE_PILL: Record<MilestoneTone, PillTone> = {
  neutral: "neutral",
  amber: "warning",
  green: "success",
};
