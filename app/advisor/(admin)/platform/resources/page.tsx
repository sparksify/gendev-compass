import type { Metadata } from "next";
import { PlatformPageShell } from "@/components/admin/PlatformPageShell";
import { ResourcesSection } from "@/components/adminSections/ResourcesSection";

export const metadata: Metadata = { title: "Resources" };
export const dynamic = "force-dynamic";

export default function AdminResourcesPage() {
  return (
    <PlatformPageShell
      title="Resources"
      subtitle="Files and links shown on the prospect-facing Resources page"
    >
      <div className="max-w-3xl">
        <ResourcesSection authHeaders={{}} hideHeader />
      </div>
    </PlatformPageShell>
  );
}
