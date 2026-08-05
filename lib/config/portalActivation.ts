/**
 * Facebook lead → private portal activation flow configuration.
 *
 * The time-based match is an MVP correlation mechanism, not strong
 * authentication (see README). Every value here is deliberately narrow and
 * tunable without a code change.
 */

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

/** How long before an activation's arrival a lead may have been received and still match. */
export function getAutoMatchBeforeSeconds(): number {
  return envInt("PORTAL_AUTO_MATCH_BEFORE_SECONDS", 120);
}

/** How long after an activation's arrival a delayed lead may still arrive and match. */
export function getAutoMatchAfterSeconds(): number {
  return envInt("PORTAL_AUTO_MATCH_AFTER_SECONDS", 30);
}

/** How long the browser keeps polling /status before the last-four fallback is offered. */
export function getActivationMaxWaitSeconds(): number {
  return envInt("PORTAL_ACTIVATION_MAX_WAIT_SECONDS", 30);
}

/** Suggested client poll interval (returned to the browser isn't required — it's a shared constant). */
export function getActivationPollIntervalMs(): number {
  return envInt("PORTAL_ACTIVATION_POLL_INTERVAL_MS", 1500);
}

/** Activation cookie / row lifetime. */
export function getActivationTtlMinutes(): number {
  return envInt("PORTAL_ACTIVATION_TTL_MINUTES", 15);
}

/** Attempts allowed on the last-four fallback before requiring manual resolution. */
export function getLastFourMaxAttempts(): number {
  return envInt("PORTAL_LAST_FOUR_MAX_ATTEMPTS", 5);
}

/**
 * Kill switch for automatic time-based matching. When false, every
 * activation goes straight to the last-four fallback — flip this if
 * real-world delivery timing makes the automatic match unreliable.
 */
export function isTimeMatchingEnabled(): boolean {
  return process.env.PORTAL_TIME_MATCHING_ENABLED !== "false";
}

export function getHighLevelWebhookSecret(): string | null {
  return process.env.HIGHLEVEL_INBOUND_WEBHOOK_SECRET ?? null;
}
