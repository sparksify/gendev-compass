import type { Metadata } from "next";
import { requireStaffUser } from "@/lib/advisor/auth";
import { TerritoryMapPanel } from "@/components/advisor/territories/TerritoryMapPanel";

export const metadata: Metadata = { title: "Territory Map" };
export const dynamic = "force-dynamic";

export default async function TerritoryMapPage() {
  await requireStaffUser();
  return <TerritoryMapPanel />;
}
