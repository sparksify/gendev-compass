import type { Metadata } from "next";
import "@fontsource-variable/inter";
import { FddSection } from "@/components/adminSections/FddSection";
import { PlatformPageShell } from "@/components/admin/PlatformPageShell";

export const metadata: Metadata = { title: "FDD Requests" };
export const dynamic = "force-dynamic";

/**
 * Styled after the NexCRM dashboard comp: Inter type, bold sans page
 * title, KPI stat cards, and soft pill badges (see FddSection).
 */
export default function AdminFddPage() {
  return (
    <PlatformPageShell
      title="FDD Requests"
      subtitle="Franchise Disclosure Document workflow: status, audit timeline, and manual retries"
    >
      <div className="max-w-3xl font-inter">
        <FddSection authHeaders={{}} hideHeader />
      </div>
    </PlatformPageShell>
  );
}
