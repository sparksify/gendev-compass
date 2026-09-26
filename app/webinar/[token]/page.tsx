import type { Metadata } from "next";
import { getStore } from "@/lib/store";
import { CMDT_OVERVIEW_REGISTRATION_URL } from "@/lib/config/webinar";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { ZoomRegistrationCard } from "@/components/webinar/ZoomRegistrationCard";
import { hasZoomAccess } from "@/lib/portal/qualification";

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

  return (
    <main className="min-h-screen bg-surface px-4 py-10 text-foreground sm:px-6 sm:py-16">
      <div className="mx-auto max-w-[850px]">
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-accent-gold">
            Congratulations
          </p>
          <h1 className="mx-auto mt-3 max-w-[700px] font-serif text-3xl leading-tight text-sidebar sm:text-[42px]">
            {lead.first_name}, you’re approved for the CMDT overview
          </h1>
          <p className="mx-auto mt-4 max-w-[640px] text-base leading-relaxed text-muted-foreground">
            {zoomEligible
              ? "Choose the live Zoom session you’d like to attend. Your information is already filled in below."
              : "Based on your current answers, we have a few more resources to share before the live presentation."}
          </p>
        </header>

        {zoomEligible ? <section aria-label="Register for the live overview" className="mt-8">
          <ZoomRegistrationCard token={token} firstName={lead.first_name} lastName={lead.last_name} email={lead.email} fallbackUrl={CMDT_OVERVIEW_REGISTRATION_URL} />
        </section> : <section className="mx-auto mt-8 max-w-[760px] rounded-card border border-border bg-card p-7 text-center shadow-card sm:p-10">
          <h2 className="font-serif text-2xl text-sidebar">Let’s build your path to CMDT</h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">Many people begin with a combination of savings, financing, retirement assets, a business partner, or other resources. Explore the information below, then complete the detailed profile when you’re ready.</p>
          <div className="mt-6 grid gap-3 text-left sm:grid-cols-2">
            <div className="rounded-md border border-border p-4"><h3 className="font-semibold text-sidebar">Learn how the model works</h3><p className="mt-1 text-sm text-muted-foreground">Review the CMDT opportunity and the owner profile we look for.</p></div>
            <div className="rounded-md border border-border p-4"><h3 className="font-semibold text-sidebar">Explore funding paths</h3><p className="mt-1 text-sm text-muted-foreground">Consider financing, partners, retirement funds, or other available resources.</p></div>
          </div>
          <a href={`/p/${token}/questionnaire`} className="mt-7 inline-flex min-h-11 items-center justify-center rounded-md bg-sidebar px-6 text-sm font-semibold text-white hover:bg-sidebar/90">Continue learning</a>
        </section>}
      </div>
    </main>
  );
}
