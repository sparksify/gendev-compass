/**
 * Bridge page (/watch) settings. The bridge is the public pre-portal stop:
 * a short video and a 2-minute fit assessment that lets a prospect decide
 * whether the opportunity is worth a closer look before they enter GenDev
 * Compass.
 *
 * The value is public (it ships to the browser), so it is read directly
 * from NEXT_PUBLIC_* so Next.js can inline it at build time.
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
