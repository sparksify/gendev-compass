import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AssetsSection } from "@/components/adminSections/AssetsSection";

export const metadata: Metadata = { title: "Branding & Assets" };
export const dynamic = "force-dynamic";

export default function BrandingPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <AdminPageHeader
        title="Branding & Assets"
        description="Site logo and brand imagery shown across the portal. Changes go live immediately."
      />
      <AssetsSection authHeaders={{}} />
    </div>
  );
}
