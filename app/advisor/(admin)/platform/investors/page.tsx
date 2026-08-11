import type { Metadata } from "next";
import {
  InvestorsDirectory,
  type InvestorsSearchParams,
} from "@/components/advisor/InvestorsDirectory";

export const metadata: Metadata = { title: "Investors" };
export const dynamic = "force-dynamic";

/** The same directory the advisor app shows at /advisor/investors, hosted
 * inside the admin dashboard so sidebar navigation never leaves the shell. */
export default async function AdminInvestorsPage({
  searchParams,
}: {
  searchParams: Promise<InvestorsSearchParams>;
}) {
  return (
    <InvestorsDirectory
      params={await searchParams}
      basePath="/advisor/platform/investors"
      title="Investors"
    />
  );
}
