import type { Metadata } from "next";
import { PlatformPageShell } from "@/components/admin/PlatformPageShell";
import { TestLeadForm } from "@/components/adminSections/TestLeadForm";

export const metadata: Metadata = { title: "Test Leads" };
export const dynamic = "force-dynamic";

export default function AdminTestLeadsPage() {
  return (
    <PlatformPageShell
      title="Test Leads"
      subtitle="Generate a personalized portal link for testing or a new prospect"
    >
      <div className="max-w-3xl">
          <TestLeadForm authHeaders={{}} />
      </div>
    </PlatformPageShell>
  );
}
