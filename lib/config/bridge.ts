/**
 * Bridge page (/watch) settings. The bridge is the public pre-portal stop:
 * a short video and a 2-minute fit assessment that lets a prospect decide
 * whether the opportunity is worth a closer look before they enter GenDev
 * Compass.
 *
 * The value is public (it ships to the browser), so it is read directly
 * from NEXT_PUBLIC_* so Next.js can inline it at build time.
 */

/** The 3-minute bridge cut. The hashed ID is public (it ships to the browser). */
const DEFAULT_BRIDGE_WISTIA_MEDIA_ID = "th7ve390tt";

/**
 * The bridge video's hashed Wistia media ID. Overridable per environment;
 * defaults to the bridge cut so the page never renders an empty player.
 */
export function getBridgeWistiaMediaId(): string {
  return process.env.NEXT_PUBLIC_BRIDGE_WISTIA_MEDIA_ID ?? DEFAULT_BRIDGE_WISTIA_MEDIA_ID;
}
