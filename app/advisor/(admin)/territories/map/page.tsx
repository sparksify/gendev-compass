import type { Metadata } from "next";
import { requireStaffUser } from "@/lib/advisor/auth";
import { TerritoryMapPanel } from "@/components/advisor/territories/TerritoryMapPanel";
import { TerritoryPageShell } from "@/components/advisor/territories/TerritoryPageShell";

export const metadata: Metadata = { title: "Territory Map" };
export const dynamic = "force-dynamic";

export default async function TerritoryMapPage() {
  await requireStaffUser();
  return (
    <TerritoryPageShell subtitle="Where every marked territory sits on the map">
      <TerritoryMapPanel />
    </TerritoryPageShell>
  );
}
