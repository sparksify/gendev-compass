import type { Metadata } from "next";
import { brand } from "@/lib/config/brand";
import { StartFlow } from "@/components/start/StartFlow";

export const metadata: Metadata = {
  title: `Accessing your portal — ${brand.productName}`,
  robots: { index: false, follow: false },
};

/**
 * Static landing target for the Facebook lead ad's thank-you button. The ad
 * cannot carry a per-lead URL, so this page matches the visitor to the lead
 * that just arrived via POST /api/leads (see app/api/start/route.ts) and
 * forwards them to their personal /p/[token] portal.
 */
export default function StartPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
        {brand.brandName}
      </p>
      <h1 className="mt-3 font-serif text-3xl font-normal text-foreground">{brand.portalLabel}</h1>
      <StartFlow supportEmail={brand.supportEmail} />
    </main>
  );
}
