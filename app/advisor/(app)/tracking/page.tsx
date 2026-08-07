import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaffUser } from "@/lib/advisor/auth";
import { isAdmin } from "@/lib/advisor/access";
import { TrackingSections } from "@/components/adminSections/TrackingSections";

export const metadata: Metadata = { title: "Tracking & Attribution" };
export const dynamic = "force-dynamic";

/**
 * Tracking & Attribution admin (Phase 11, spec §3): GTM, Meta browser
 * tracking, Meta Conversions API, event mapping, and delivery diagnostics.
 * ADMIN-only, same session-authenticated pattern as /advisor/platform.
 */
export default async function TrackingPage() {
  const user = await requireStaffUser();
  if (!isAdmin(user)) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-serif text-2xl font-semibold text-foreground">Tracking & Attribution</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Google Tag Manager, Meta Pixel, Meta Conversions API, and event delivery diagnostics.
        Changes take effect immediately — no deployment required.
      </p>
      <div className="mt-6">
        <TrackingSections authHeaders={{}} />
      </div>
    </div>
  );
}
