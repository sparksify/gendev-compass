import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { TrackingSections } from "@/components/adminSections/TrackingSections";

export const metadata: Metadata = { title: "Tracking & Pixels" };
export const dynamic = "force-dynamic";

/**
 * Tracking & Pixels admin (Phase 11, spec §3): GTM, Meta browser tracking,
 * Meta Conversions API, event mapping, and delivery diagnostics. The (admin)
 * layout guarantees an ADMIN session.
 */
export default function AdminTrackingPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <AdminPageHeader
        title="Tracking & Pixels"
        description="Google Tag Manager, Meta Pixel, Meta Conversions API, and event delivery diagnostics. Changes take effect immediately — no deployment required."
      />
      <TrackingSections authHeaders={{}} />
    </div>
  );
}
