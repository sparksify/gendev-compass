import { isProduction } from "./env";

/**
 * Authorizes Vercel Cron invocations. When a CRON_SECRET env var is set,
 * Vercel automatically sends it as `Authorization: Bearer <secret>` on every
 * scheduled request (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs)
 * — we only need to verify it matches. Without CRON_SECRET configured,
 * cron routes are only reachable outside production (same fallback pattern
 * as the admin routes' password gate), so nothing scheduled runs
 * unauthenticated in production by accident.
 */
export function authorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) return request.headers.get("authorization") === `Bearer ${secret}`;
  return !isProduction();
}
