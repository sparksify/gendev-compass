import type { Metadata } from "next";
import { PlatformPageShell } from "@/components/admin/PlatformPageShell";
import { ZipDataSection } from "@/components/adminSections/ZipDataSection";

export const metadata: Metadata = { title: "ZIP & Geo Data" };
export const dynamic = "force-dynamic";

export default function AdminZipDataPage() {
  return (
    <PlatformPageShell
      title="ZIP & Geo Data"
      subtitle="Nationwide ZIP reference data and boundary shapes for the Territory Advisor"
    >
      <div className="max-w-3xl">
        <ZipDataSection authHeaders={{}} hideHeader />
      </div>
    </PlatformPageShell>
  );
}
