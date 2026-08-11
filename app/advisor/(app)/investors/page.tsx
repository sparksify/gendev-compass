import type { Metadata } from "next";
import {
  InvestorsDirectory,
  type InvestorsSearchParams,
} from "@/components/advisor/InvestorsDirectory";

export const metadata: Metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

export default async function InvestorsPage({
  searchParams,
}: {
  searchParams: Promise<InvestorsSearchParams>;
}) {
  return (
    <InvestorsDirectory params={await searchParams} basePath="/advisor/investors" title="Clients" />
  );
}
