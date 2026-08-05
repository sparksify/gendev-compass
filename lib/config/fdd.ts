/**
 * FDD workflow configuration. Server-side only — GoHighLevel credentials and
 * the webhook signing secret must never reach the browser.
 *
 * Environment variables:
 *   GHL_FDD_WEBHOOK_URL      Inbound-webhook trigger for the FDD workflow (preferred).
 *   GHL_API_TOKEN            GoHighLevel API token (used when no webhook URL is set).
 *   GHL_LOCATION_ID          GoHighLevel location (sub-account) ID.
 *   GHL_FDD_WORKFLOW_ID      Workflow the contact should be enrolled in.
 *   GHL_FDD_REQUEST_TAG      Tag applied when the FDD is requested (default FDD_REQUESTED).
 *   FDD_WEBHOOK_SECRET       HMAC secret for inbound provider webhooks.
 *   FDD_WAITING_PERIOD_DAYS  Waiting period length (default 14). Approved by counsel.
 */

export interface GhlConfig {
  webhookUrl: string | null;
  apiToken: string | null;
  locationId: string | null;
  workflowId: string | null;
  requestTag: string;
}

export function getGhlConfig(): GhlConfig {
  return {
    webhookUrl: process.env.GHL_FDD_WEBHOOK_URL ?? null,
    apiToken: process.env.GHL_API_TOKEN ?? null,
    locationId: process.env.GHL_LOCATION_ID ?? null,
    workflowId: process.env.GHL_FDD_WORKFLOW_ID ?? null,
    requestTag: process.env.GHL_FDD_REQUEST_TAG ?? "FDD_REQUESTED",
  };
}

export function isGhlConfigured(): boolean {
  const config = getGhlConfig();
  return Boolean(config.webhookUrl || (config.apiToken && config.locationId));
}

export function getFddWebhookSecret(): string | null {
  return process.env.FDD_WEBHOOK_SECRET ?? null;
}

const DEFAULT_WAITING_PERIOD_DAYS = 14;

/** Configurable waiting period between FDD receipt and agreement eligibility. */
export function getFddWaitingPeriodDays(): number {
  const raw = Number(process.env.FDD_WAITING_PERIOD_DAYS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_WAITING_PERIOD_DAYS;
}
