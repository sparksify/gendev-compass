import type { Metadata } from "next";
import { CalendarDays, ExternalLink } from "lucide-react";
import { getStore } from "@/lib/store";
import { getCalendarEmbedUrl } from "@/lib/config/env";
import { CMDT_OVERVIEW_REGISTRATION_URL } from "@/lib/config/webinar";
import { InvalidPortal } from "@/components/portal/InvalidPortal";

export const metadata: Metadata = {
  title: "Reserve Your Spot | CMDT Live Overview",
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
            Your next step
          </p>
          <h1 className="mx-auto mt-3 max-w-[700px] font-serif text-3xl leading-tight text-sidebar sm:text-[42px]">
            {lead.first_name}, join us live for the CMDT overview
          </h1>
          <p className="mx-auto mt-4 max-w-[640px] text-base leading-relaxed text-muted-foreground">
            Choose an upcoming session below and register for the live franchise overview and Q&amp;A.
            Zoom will email your personal link after you register.
          </p>
        </header>

        <section aria-label="Register for the live overview" className="mt-8 rounded-card border border-border bg-card p-3 shadow-card sm:p-6">
          <div className="mb-4 flex items-center gap-3 border-b border-border pb-4 text-sidebar">
            <CalendarDays className="size-5 shrink-0 text-accent-gold" aria-hidden="true" />
            <h2 className="font-serif text-xl">Reserve your spot</h2>
          </div>
          <iframe
            title="Zoom registration for the CMDT live franchise overview"
            src={CMDT_OVERVIEW_REGISTRATION_URL}
            className="h-[950px] w-full rounded-md border border-border sm:h-[830px]"
            referrerPolicy="strict-origin-when-cross-origin"
          />
          <p className="mt-3 text-sm text-muted-foreground">
            If the form doesn’t load, {" "}
            <a
              href={CMDT_OVERVIEW_REGISTRATION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-2"
            >
              open registration on Zoom <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>.
          </p>
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
