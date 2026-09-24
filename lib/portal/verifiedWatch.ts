/** Wistia unique seconds excludes seeks and repeat playback. Never use playhead
 * or our historical wall-clock accumulator as evidence of unique viewing.
 * These are first-party player reports, not server-attested viewing analytics. */
export function verifiedWatch(seconds: number | undefined, duration: number): number | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || !Number.isFinite(duration) || duration < 1 || seconds < 0 || seconds > duration + 1) return null;
  return Math.min(100, Math.floor((seconds / duration) * 10000) / 100);
}
