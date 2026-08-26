import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { LoginForm } from "@/components/advisor/LoginForm";
import { getCurrentStaffUser } from "@/lib/advisor/auth";
import { brand } from "@/lib/config/brand";

export const metadata: Metadata = { title: "Advisor Sign In" };
export const dynamic = "force-dynamic";

export default async function AdvisorLoginPage() {
  const user = await getCurrentStaffUser();
  if (user) redirect("/advisor");

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="font-serif text-[26px] leading-[1.2] font-semibold text-foreground">{brand.productName}</p>
          <p className="mt-1 text-[15.5px] leading-[1.45] text-muted-foreground">Advisor &amp; Admin Dashboard</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <LoginForm />
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-[13.5px] leading-[1.45] text-faint-foreground">
          Internal use only. Access is logged.
        </p>
      </div>
    </main>
  );
}
