import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { TestLeadForm } from "@/components/adminSections/TestLeadForm";

export const metadata: Metadata = { title: "Test Leads" };
export const dynamic = "force-dynamic";

export default function AdminTestLeadsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <AdminPageHeader
        title="Test Leads"
        description="Generate a personalized portal link for testing or a new prospect."
      />
      <TestLeadForm authHeaders={{}} />
    </div>
  );
}
