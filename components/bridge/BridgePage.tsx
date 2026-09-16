import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AttributionCapture } from "@/components/tracking/AttributionCapture";
import { BridgeBackdrop } from "@/components/bridge/BridgeBackdrop";
import { BridgeFooter } from "@/components/bridge/BridgeFooter";
import { BridgeVideo } from "@/components/bridge/BridgeVideo";
import { BridgeVideoProvider } from "@/components/bridge/BridgeVideoContext";
import { CloseBotTracking } from "@/components/bridge/CloseBotTracking";
import { FitAssessment, type KnownBridgeLead } from "@/components/bridge/FitAssessment";
import { ProofStrip } from "@/components/bridge/ProofStrip";
import { ScrollToAssessment } from "@/components/bridge/ScrollToAssessment";

/**
 * The bridge page body, shared by the anonymous route (/watch) and the
 * tokenized one (/watch/[token]).
 *
 *   headline → 3-minute video → "See if CMDT fits me" → four proof points
 *   → 2-minute assessment → Research Center or Book a Call
 *
 * With a known lead the greeting is personal, the video reports to the
 * lead's tracked history, attribution is captured exactly as in the
 * portal, and the assessment skips the contact step.
 */
export function BridgePage({ mediaId, known }: { mediaId: string; known?: KnownBridgeLead }) {
  return (
    <BridgeVideoProvider initialToken={known?.token ?? null}>
      <CloseBotTracking />
      {known && <AttributionCapture token={known.token} />}
      <main className="relative flex min-h-screen flex-col overflow-hidden">
        <section className="relative px-5 pb-12 pt-14 sm:px-8 sm:pb-16 sm:pt-20">
          <BridgeBackdrop />

          <div className="relative mx-auto w-full max-w-[880px]">
            <header className="mx-auto max-w-[720px] text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent-gold sm:text-[12.5px] sm:tracking-[0.12em]">
                {known ? `${known.firstName}, before` : "Before"} you decide if CMDT is for you,
                watch this
              </p>
              <h1 className="mt-4 font-serif text-[34px] font-medium leading-[1.1] tracking-[-0.015em] text-sidebar sm:text-[44px]">
                See How Complete Mobile Drug Testing Works
                <span className="block text-accent-gold">&mdash; In 3 Minutes</span>
              </h1>
              <p className="mx-auto mt-5 max-w-[560px] text-[15.5px] leading-[1.6] text-muted-foreground sm:text-[16px]">
                A quick, no-pressure look at the business model, what owners do, and why companies
                use these services.
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
              <ScrollToAssessment />
              <p className="text-[13px] text-muted-foreground">
                Answer a few quick questions. Takes about 2 minutes.
              </p>
            </div>

            <div className="mt-12 sm:mt-14">
              <ProofStrip />
            </div>
          </div>
        </section>

        <section
          id="assessment"
          className="border-t border-border bg-card px-5 py-14 sm:px-8 sm:py-20"
        >
          <div className="mx-auto w-full max-w-[720px]">
            <FitAssessment known={known} />
          </div>
        </section>

        <BridgeFooter />
      </main>
    </BridgeVideoProvider>
  );
}
