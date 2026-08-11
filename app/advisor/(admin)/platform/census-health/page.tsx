import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CensusDataHealthSection } from "@/components/adminSections/CensusDataHealthSection";

export const metadata: Metadata = { title: "Census Data Health" };
export const dynamic = "force-dynamic";

export default function AdminCensusHealthPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <AdminPageHeader
        title="Census Data Health"
        description="ACS 5-Year demographic data powering territory searches — vintage, coverage, and import status."
      />
      <CensusDataHealthSection authHeaders={{}} hideHeader />
    </div>
  );
}
