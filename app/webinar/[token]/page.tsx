import type { Metadata } from "next";
import { getStore } from "@/lib/store";
import { CMDT_OVERVIEW_REGISTRATION_URL } from "@/lib/config/webinar";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { ZoomRegistrationCard } from "@/components/webinar/ZoomRegistrationCard";
import { hasZoomAccess } from "@/lib/portal/qualification";
import { bridgeCapitalBand } from "@/lib/config/qualification";

export const metadata: Metadata = {
  title: "Your Zoom Registration | CMDT Live Overview",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WebinarRegistrationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const lead = token.length >= 16 && token.length <= 128
    ? await getStore().getLeadByToken(token)
    : null;

  if (!lead) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <InvalidPortal />
      </div>
    );
  }

  const zoomEligible = hasZoomAccess(lead);
  const capitalBand = bridgeCapitalBand(lead.initial_liquid_capital);
  const under25 = capitalBand === "under-25k";
  const closeToMinimum = capitalBand === "25k-49k";

  return (
    <main className="min-h-screen bg-surface px-4 py-10 text-foreground sm:px-6 sm:py-16">
      <div className="mx-auto max-w-[850px]">
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-accent-gold">
            {zoomEligible ? "Congratulations" : "Next step"}
          </p>
          <h1 className="mx-auto mt-3 max-w-[700px] font-serif text-3xl leading-tight text-sidebar sm:text-[42px]">
            {zoomEligible
              ? `${lead.first_name}, you’re ready for the CMDT overview`
              : under25
                ? `Thanks, ${lead.first_name} — here’s where things stand`
                : closeToMinimum
                  ? `${lead.first_name}, you may be close to CMDT’s initial financial requirements`
                  : `${lead.first_name}, let’s complete your Compass profile`}
          </h1>
          <p className="mx-auto mt-4 max-w-[640px] text-base leading-relaxed text-muted-foreground">
            {zoomEligible
              ? "You meet the initial financial requirement. Choose a live Zoom session below to continue."
              : under25
                ? "Based on the information you provided, you do not currently appear to meet CMDT’s minimum liquid-capital requirement of $50,000."
                : closeToMinimum
                  ? "CMDT currently requires at least $50,000 in liquid capital. You may not yet meet that threshold, but we’d like to understand your situation more clearly."
                  : "Complete the detailed Compass profile so we can evaluate your goals, experience, and fit."}
          </p>
        </header>

        {zoomEligible ? <section aria-label="Register for the live overview" className="mt-8">
          <ZoomRegistrationCard token={token} firstName={lead.first_name} lastName={lead.last_name} email={lead.email} fallbackUrl={CMDT_OVERVIEW_REGISTRATION_URL} />
        </section> : <section className="mx-auto mt-8 max-w-[760px] rounded-card border border-border bg-card p-7 text-center shadow-card sm:p-10">
          <h2 className="font-serif text-2xl text-sidebar">Want to understand CMDT better?</h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">Watch the short overview to learn how the business model works, what franchise owners do, who CMDT serves, and what we look for in a potential owner.</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a href={`/watch/${token}`} className="inline-flex min-h-11 items-center justify-center rounded-md bg-sidebar px-6 text-sm font-semibold text-white hover:bg-sidebar/90">Watch the CMDT overview</a>
            {under25 ? <a href={`/p/${token}/opportunity`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-sidebar/40 px-6 text-sm font-semibold text-sidebar hover:bg-surface">Learn more about CMDT</a> : <a href={`/p/${token}/questionnaire`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-sidebar/40 px-6 text-sm font-semibold text-sidebar hover:bg-surface">Complete my Compass profile</a>}
          </div>
        </section>}
      </div>
    </main>
  );
}
