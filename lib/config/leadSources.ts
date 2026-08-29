/**
 * Friendly labels and badge styling for lead `source` values.
 *
 * The portal stores whatever the sending automation posts to /api/leads
 * (e.g. the GoHighLevel workflow per Facebook ad account). Register each
 * value here to control how it reads in the CRM; unregistered values fall
 * back to the raw string so new sources are never hidden.
 */

export interface LeadSourceMeta {
  label: string;
  /** Pill styling in the advisor theme (border + tint + text). */
  badgeClass: string;
}

const NEUTRAL_BADGE = "border-border bg-surface text-secondary-foreground";

const KNOWN_SOURCES: Record<string, LeadSourceMeta> = {
  // One entry per Facebook ad account — the GHL workflow for each account
  // must send the matching `source` value with every lead.
  "facebook-sparks": {
    label: "Sparks FB",
    badgeClass: "border-[#b9cffc] bg-[#eff6ff] text-[#2463eb]",
  },
  "facebook-gendev": {
    label: "GenDev FB",
    badgeClass: "border-[#b3e2c3] bg-[#f0fdf4] text-[#15803d]",
  },
  // Legacy value sent before per-account attribution was configured.
  facebook: {
    label: "Facebook (unattributed)",
    badgeClass: "border-[#d7dee9] bg-[#f5f7fb] text-[#64748b]",
  },
  "facebook-lead-ad": {
    label: "Facebook (unattributed)",
    badgeClass: "border-[#d7dee9] bg-[#f5f7fb] text-[#64748b]",
  },
  "internal-test": {
    label: "Internal Test",
    badgeClass: "border-[#f0d9a8] bg-[#fef9ec] text-[#92600e]",
  },
  "demo-seed": {
    label: "Demo",
    badgeClass: "border-[#f0d9a8] bg-[#fef9ec] text-[#92600e]",
  },
  "live-smoke-test": {
    label: "Smoke Test",
    badgeClass: "border-[#f0d9a8] bg-[#fef9ec] text-[#92600e]",
  },
};

export function leadSourceMeta(source: string | null | undefined): LeadSourceMeta | null {
  if (!source) return null;
  return KNOWN_SOURCES[source] ?? { label: source, badgeClass: NEUTRAL_BADGE };
}

export function leadSourceLabel(source: string | null | undefined): string {
  return leadSourceMeta(source)?.label ?? "—";
}
