import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ResourcesSection } from "@/components/adminSections/ResourcesSection";

export const metadata: Metadata = { title: "Resources" };
export const dynamic = "force-dynamic";

export default function AdminResourcesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <AdminPageHeader
        title="Resources"
        description="Files and links shown on the prospect-facing Resources page."
      />
      <ResourcesSection authHeaders={{}} hideHeader />
    </div>
  );
}
