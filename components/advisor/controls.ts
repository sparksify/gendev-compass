/**
 * The advisor buttons — there are three, and the handoff is strict about
 * which one goes where.
 *
 *   ACCENT    yellow, one per view: the single move the screen wants next
 *             (Save, Send FDD, New Client, Add Team Member, Review).
 *   SECONDARY white with a green hairline: everything else that is still an
 *             action (Export, Import CSV, Copy link, Update Password).
 *   TERTIARY  bare green text, for the dismiss/skip half of a pair.
 *
 * Exported as class strings so links, buttons and submit inputs can all wear
 * them without a wrapper component.
 */

const BASE =
  "inline-flex items-center justify-center gap-[7px] rounded-control font-bold transition-colors disabled:opacity-50";

export const ACCENT_BUTTON = `${BASE} bg-accent px-4 py-[9px] text-[13px] text-accent-foreground hover:bg-accent-hover`;

export const SECONDARY_BUTTON = `${BASE} border border-border-strong bg-card px-[15px] py-[9px] text-[13px] text-primary hover:bg-primary-soft`;

export const TERTIARY_BUTTON =
  "text-[12.5px] font-bold text-accent-strong transition-colors hover:text-foreground disabled:opacity-50";

/** Same shapes one step down, for buttons that sit inside a row or a card. */
export const ACCENT_BUTTON_SM = `${BASE} bg-accent px-3 py-[5px] text-[12px] text-accent-foreground hover:bg-accent-hover`;

export const SECONDARY_BUTTON_SM = `${BASE} border border-border-strong bg-card px-[11px] py-[5px] text-[12px] text-primary hover:bg-primary-soft`;

/**
 * Kept as aliases so the pre-v3 call sites (portal-adjacent screens, forms)
 * keep compiling; both now resolve to the v3 shapes above. New code should
 * name the accent/secondary constants directly.
 */
export const INK_BUTTON = ACCENT_BUTTON;
export const INK_BUTTON_SM = ACCENT_BUTTON_SM;

/** The green hairline input every v3 form field wears. */
export const FIELD =
  "w-full rounded-control border border-border bg-card px-3 py-[9px] text-[13px] text-foreground outline-none transition-colors placeholder:text-[#8b968f] focus:border-primary";

/** The 12.5/600 label above a field. */
export const FIELD_LABEL = "mb-[5px] block text-[12.5px] font-semibold text-secondary-foreground";
