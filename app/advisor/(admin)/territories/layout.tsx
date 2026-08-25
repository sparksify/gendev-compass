import { notFound } from "next/navigation";
import { requireStaffUser } from "@/lib/advisor/auth";
import { isAdmin } from "@/lib/advisor/access";

export const dynamic = "force-dynamic";

/**
 * Admin-only Territory Advisor configuration. Each tab renders its own page
 * header (title + tab row + actions), so this layout only guards access —
 * same 404-for-unauthorized pattern used for lead access elsewhere.
 */
export default async function TerritoriesLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffUser();
  if (!isAdmin(user)) notFound();
  return <>{children}</>;
}
