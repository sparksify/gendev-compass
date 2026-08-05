/**
 * Server-side environment access. Import only from server code.
 * NEXT_PUBLIC_* values are read directly where needed so Next.js can inline them.
 */

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Development helpers (simulate-video button, progress reset, FDD
 * acknowledgment simulation) are available outside production, on Vercel
 * preview deployments (branch/PR builds), or when explicitly enabled for a
 * staging environment via ENABLE_DEV_TOOLS=true. Never enabled on the
 * production deployment itself.
 */
export function devToolsEnabled(): boolean {
  if (process.env.VERCEL_ENV === "preview") return true;
  if (process.env.ENABLE_DEV_TOOLS === "true" && process.env.VERCEL_ENV !== "production") {
    return true;
  }
  return !isProduction();
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export function getInternalApiKey(): string | null {
  return process.env.INTERNAL_API_KEY ?? null;
}

export function getAdminTestPassword(): string | null {
  return process.env.ADMIN_TEST_PASSWORD ?? null;
}

/** The investor overview media. The hashed ID is public (it ships to the browser). */
const DEFAULT_WISTIA_MEDIA_ID = "c5afogjpob";

export function getWistiaMediaId(): string | null {
  return (
    process.env.NEXT_PUBLIC_WISTIA_MEDIA_ID ?? process.env.WISTIA_MEDIA_ID ?? DEFAULT_WISTIA_MEDIA_ID
  );
}

/** The advisor's GoHighLevel booking widget (public URL; ships to the browser). */
const DEFAULT_CALENDAR_EMBED_URL =
  "https://go.completemobiledrugtestingus.com/widget/bookings/darko-vasic-personal-calendar-qa2dbvkcw";

export function getCalendarEmbedUrl(): string | null {
  return (
    process.env.NEXT_PUBLIC_CALENDAR_EMBED_URL ??
    process.env.CALENDAR_EMBED_URL ??
    DEFAULT_CALENDAR_EMBED_URL
  );
}
