import type { Metadata } from "next";
import { TrackingSections } from "@/components/adminSections/TrackingSections";

export const metadata: Metadata = { title: "Tracking & Pixels" };
export const dynamic = "force-dynamic";

/**
 * Tracking & Pixels admin (Phase 11, spec §3): GTM, Meta browser tracking,
 * Meta Conversions API, consent, and delivery diagnostics. The (admin)
 * layout guarantees an ADMIN session; the screen renders its own header.
 */
export default function AdminTrackingPage() {
  return <TrackingSections authHeaders={{}} />;
}
