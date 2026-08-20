import type { Metadata } from "next";
import "@fontsource-variable/inter";
import { FddSection } from "@/components/adminSections/FddSection";

export const metadata: Metadata = { title: "FDD Requests" };
export const dynamic = "force-dynamic";

/**
 * Styled after the NexCRM dashboard comp: Inter type, bold sans page
 * title, KPI stat cards, and soft pill badges (see FddSection).
 */
export default function AdminFddPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 font-inter">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">FDD Requests</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Franchise Disclosure Document workflow: status, audit timeline, and manual retries.
        </p>
      </div>
      <FddSection authHeaders={{}} hideHeader />
    </div>
  );
}
