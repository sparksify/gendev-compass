import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ZipDataSection } from "@/components/adminSections/ZipDataSection";

export const metadata: Metadata = { title: "ZIP & Geo Data" };
export const dynamic = "force-dynamic";

export default function AdminZipDataPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <AdminPageHeader
        title="ZIP & Geo Data"
        description="Nationwide ZIP reference data and boundary shapes for the Territory Advisor."
      />
      <ZipDataSection authHeaders={{}} hideHeader />
    </div>
  );
}
