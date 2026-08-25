import type { Metadata } from "next";
import { PlatformPageShell } from "@/components/admin/PlatformPageShell";
import { AssetsSection } from "@/components/adminSections/AssetsSection";

export const metadata: Metadata = { title: "Branding & Assets" };
export const dynamic = "force-dynamic";

export default function BrandingPage() {
  return (
    <PlatformPageShell
      title="Branding & Assets"
      subtitle="Site logo and brand imagery shown across the portal — changes go live immediately"
    >
      <div className="max-w-3xl">
        <AssetsSection authHeaders={{}} />
      </div>
    </PlatformPageShell>
  );
}
