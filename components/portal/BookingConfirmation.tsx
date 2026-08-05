"use client";

import { useEffect, useState } from "react";
import { CalendarCheck2, CalendarPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AppointmentDetails } from "@/components/portal/AppointmentDetails";

interface BookingConfirmationProps {
  advisorName: string;
  advisorEmail: string;
  /** ISO start time when the scheduling provider supplied it; null otherwise. */
  startAt: string | null;
  /** Where the confirmation email was sent. */
  email: string;
}

/** Assumed consultation length for calendar links when the provider gives only a start time. */
const CONSULTATION_MINUTES = 60;

function toCalendarStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * State B: the calendar is replaced by the booking confirmation — date, time,
 * time zone, advisor, add-to-calendar options, and reschedule guidance.
 */
export function BookingConfirmation({
  advisorName,
  advisorEmail,
  startAt,
  email,
}: BookingConfirmationProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const title = `Franchise Consultation with ${advisorName}`;
  let googleUrl: string | null = null;
  let icsHref: string | null = null;

  if (startAt && mounted) {
    const start = new Date(startAt);
    const end = new Date(start.getTime() + CONSULTATION_MINUTES * 60_000);
    const dates = `${toCalendarStamp(start)}/${toCalendarStamp(end)}`;
    const details = "Consultation to discuss your investment goals and evaluate the opportunity.";

    const google = new URL("https://calendar.google.com/calendar/render");
    google.searchParams.set("action", "TEMPLATE");
    google.searchParams.set("text", title);
    google.searchParams.set("dates", dates);
    google.searchParams.set("details", details);
    googleUrl = google.toString();

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Investor Portal//Consultation//EN",
      "BEGIN:VEVENT",
      `DTSTAMP:${toCalendarStamp(new Date(startAt))}`,
      `DTSTART:${toCalendarStamp(start)}`,
      `DTEND:${toCalendarStamp(end)}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${details}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    icsHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 font-serif text-4xl font-normal leading-[1.1] tracking-[-0.01em] text-foreground sm:text-[42px]">
          <CalendarCheck2 className="size-7 shrink-0 text-success" />
          Your Consultation Is Scheduled
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          We&apos;ve sent the appointment details to your email. {advisorName} will review your
          investor profile before your conversation.
        </p>
      </div>

      <Card>
        <CardContent>
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Appointment Details
          </h2>
          {startAt ? (
            <>
              <AppointmentDetails startAt={startAt} />
              <dl className="mt-2 space-y-2 text-sm text-foreground">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Advisor</dt>
                  <dd className="min-w-0 break-words text-right font-medium">{advisorName}</dd>
                </div>
              </dl>
              {(googleUrl || icsHref) && (
                <div className="mt-4 flex flex-wrap gap-2.5 border-t border-border-soft pt-4">
                  {googleUrl && (
                    <a
                      href={googleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-control border border-border bg-card px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface"
                    >
                      <CalendarPlus className="size-[15px]" strokeWidth={1.8} />
                      Add to Google Calendar
                    </a>
                  )}
                  {icsHref && (
                    <a
                      href={icsHref}
                      download="consultation.ics"
                      className="inline-flex items-center gap-2 rounded-control border border-border bg-card px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface"
                    >
                      <CalendarPlus className="size-[15px]" strokeWidth={1.8} />
                      Apple / Outlook (.ics)
                    </a>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Your booking is confirmed with {advisorName}. A calendar invitation with the exact
              date and time has been sent to <span className="break-words">{email}</span>.
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Need to reschedule? Use the link in your confirmation email, or contact {advisorName}{" "}
        directly at{" "}
        <a className="text-primary hover:underline" href={`mailto:${advisorEmail}`}>
          {advisorEmail}
        </a>
        .
      </p>
    </div>
  );
}
