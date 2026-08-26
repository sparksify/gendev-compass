import type { Metadata } from "next";
import { PlatformPageShell } from "@/components/admin/PlatformPageShell";
import { CensusDataHealthSection } from "@/components/adminSections/CensusDataHealthSection";

export const metadata: Metadata = { title: "Census Data Health" };
export const dynamic = "force-dynamic";

export default function AdminCensusHealthPage() {
  return (
    <PlatformPageShell
      title="Census Data Health"
      subtitle="ACS 5-Year demographic data powering territory searches — vintage, coverage, and import status"
    >
      <div className="max-w-3xl">
        <CensusDataHealthSection authHeaders={{}} hideHeader />
      </div>
    </PlatformPageShell>
  );
}
