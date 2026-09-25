import type { Metadata } from "next";
import { getStore } from "@/lib/store";
import { getCalendarEmbedUrl } from "@/lib/config/env";
import { CMDT_OVERVIEW_REGISTRATION_URL } from "@/lib/config/webinar";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { ZoomRegistrationCard } from "@/components/webinar/ZoomRegistrationCard";

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

  const calendarUrl = getCalendarEmbedUrl();

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
            Choose the live Zoom session you’d like to attend. Your information is already filled in below.
          </p>
        </header>

        <section aria-label="Register for the live overview" className="mt-8">
          <ZoomRegistrationCard
            fallbackUrl={CMDT_OVERVIEW_REGISTRATION_URL}
          />
        </section>

        {calendarUrl && (
          <section className="mx-auto mt-8 max-w-[640px] text-center">
            <h2 className="font-serif text-xl text-sidebar">Want to talk sooner?</h2>
            <p className="mt-2 text-base text-muted-foreground">
              You can schedule a private conversation with the CMDT team.
            </p>
            <a
              href={calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-sidebar/40 px-5 text-sm font-semibold text-sidebar hover:bg-card"
            >
              Schedule a conversation
            </a>
          </section>
        )}
      </div>
    </main>
  );
}
