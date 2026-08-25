/**
 * The two advisor buttons — there are only two. Primary is ink (never blue:
 * blue belongs to Stage 2), secondary is white with a #d0d5dd border.
 * Exported as class strings so links, buttons and submit inputs can all wear
 * them without a wrapper component.
 */
export const INK_BUTTON =
  "inline-flex items-center justify-center gap-1.5 rounded-control bg-foreground px-[15px] py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-50";

export const SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-1.5 rounded-control border border-border-strong bg-card px-[13px] py-2 text-[12.5px] font-semibold text-foreground transition-colors hover:bg-surface-raised disabled:opacity-50";

/** Same shapes one step down, for buttons that sit inside a row or card. */
export const INK_BUTTON_SM =
  "inline-flex items-center justify-center gap-1.5 rounded-control bg-foreground px-[13px] py-2 text-[12px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-50";

export const SECONDARY_BUTTON_SM =
  "inline-flex items-center justify-center gap-1.5 rounded-control border border-border-strong bg-card px-[13px] py-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-surface-raised disabled:opacity-50";
