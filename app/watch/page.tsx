import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BridgeBackdrop } from "@/components/bridge/BridgeBackdrop";
import { BridgeVideo } from "@/components/bridge/BridgeVideo";
import { getBridgeContinueUrl, getBridgeWistiaMediaId } from "@/lib/config/bridge";

export const metadata: Metadata = {
  title: "See How Complete Mobile Drug Testing Works — In 3 Minutes",
  description:
    "A quick, no-pressure look at the business model, what owners actually do, and why companies use these services.",
  robots: { index: false, follow: false },
};

/**
 * The bridge page: the public stop before GenDev Compass. One short video,
 * no logos, no form. Styled with the portal's own tokens (surface, navy,
 * antique gold, serif display) so the handoff into the portal feels
 * continuous.
 */
export default function WatchPage() {
  const mediaId = getBridgeWistiaMediaId();
  const continueUrl = getBridgeContinueUrl();

  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden px-5 pb-16 pt-14 sm:px-8 sm:pt-20">
      <BridgeBackdrop />

      <div className="relative w-full max-w-[880px]">
        <header className="mx-auto max-w-[720px] text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent-gold sm:text-[12.5px] sm:tracking-[0.12em]">
            Before you decide if CMDT is for you, watch this
          </p>
          <h1 className="mt-4 font-serif text-[34px] font-medium leading-[1.1] tracking-[-0.015em] text-sidebar sm:text-[44px]">
            See How Complete Mobile Drug Testing Actually Works
            <span className="block text-accent-gold">&mdash; In 3 Minutes</span>
          </h1>
          <p className="mx-auto mt-5 max-w-[560px] text-[15.5px] leading-[1.6] text-muted-foreground sm:text-[16px]">
            A quick, no-pressure look at the business model, what owners actually do, and why
            companies use these services.
          </p>
        </header>

        <Card className="mt-10 overflow-hidden sm:mt-12">
          <div className="p-2.5 sm:p-3">
            <BridgeVideo mediaId={mediaId} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-border-soft px-5 py-3.5 text-[13px] text-muted-foreground">
            <span className="flex items-center gap-2">
              <Clock className="size-[15px] text-faint-foreground" strokeWidth={1.7} />
              <span className="font-medium text-foreground">3-minute overview.</span>
            </span>
            <span className="hidden h-3.5 w-px bg-border sm:block" aria-hidden />
            <span>No sales call required.</span>
          </div>
        </Card>

        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <Link
            href={continueUrl}
            className="inline-flex h-[46px] items-center gap-2.5 rounded-[7px] bg-sidebar px-6 text-[14px] font-medium text-white shadow-[0_1px_2px_rgb(16_24_40/0.08)] transition-colors hover:bg-sidebar/90"
          >
            Continue to Your Portal <ArrowRight className="size-4" strokeWidth={1.8} />
          </Link>
          <p className="text-[12.5px] text-faint-foreground">
            Watch first. Then decide whether it&rsquo;s worth a closer look.
          </p>
        </div>
      </div>
    </main>
  );
}
