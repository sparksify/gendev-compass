import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaffUser } from "@/lib/advisor/auth";
import { isAdmin } from "@/lib/advisor/access";
import { AdminSections } from "@/components/adminSections/AdminSections";

export const metadata: Metadata = { title: "Platform" };
export const dynamic = "force-dynamic";

/**
 * Platform tools inside the unified staff dashboard (ADMIN role): site
 * branding assets, FDD workflow, territory data loads, and test leads.
 * Session-authenticated — no separate admin password needed; the admin
 * APIs accept the staff session (lib/advisor/adminAccess.ts).
 */
export default async function PlatformPage() {
  const user = await requireStaffUser();
  if (!isAdmin(user)) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-serif text-2xl font-semibold text-foreground">Platform</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Branding, FDD workflow, territory data, and testing tools. Changes go live immediately.
      </p>
      <div className="mt-6">
        <AdminSections authHeaders={{}} />
      </div>
    </div>
  );
}
