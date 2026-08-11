import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { FddSection } from "@/components/adminSections/FddSection";

export const metadata: Metadata = { title: "FDD Requests" };
export const dynamic = "force-dynamic";

export default function AdminFddPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <AdminPageHeader
        title="FDD Requests"
        description="Franchise Disclosure Document workflow: status, audit timeline, and manual retries."
      />
      <FddSection authHeaders={{}} hideHeader />
    </div>
  );
}
