/**
 * Bridge page (/watch) settings. The bridge is the public pre-portal stop:
 * a single short video that lets a prospect decide whether the opportunity
 * is worth a closer look before they enter GenDev Compass.
 *
 * Both values are public (they ship to the browser), so they are read
 * directly from NEXT_PUBLIC_* so Next.js can inline them at build time.
 */

/**
 * The bridge video's hashed Wistia media ID. Falls back to the investor
 * overview until a dedicated bridge cut is configured, so the page never
 * renders an empty player.
 */
export function getBridgeWistiaMediaId(): string | null {
  return (
    process.env.NEXT_PUBLIC_BRIDGE_WISTIA_MEDIA_ID ??
    process.env.NEXT_PUBLIC_WISTIA_MEDIA_ID ??
    null
  );
}

/**
 * Where the bridge sends visitors who want to keep going. Defaults to the
 * /start handoff (the same entry the lead ad uses), which forwards them to
 * their personal portal.
 */
export function getBridgeContinueUrl(): string {
  return process.env.NEXT_PUBLIC_BRIDGE_CONTINUE_URL?.trim() || "/start";
}
