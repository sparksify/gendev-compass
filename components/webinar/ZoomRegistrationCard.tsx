"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, ExternalLink, Loader2, Video } from "lucide-react";

interface Occurrence {
  occurrenceId: string;
  startTime: string;
  duration: number;
}

interface Meeting {
  topic: string;
  timezone: string;
  registrationType: number | null;
  occurrences: Occurrence[];
}

function sessionLabel(startTime: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(startTime));
}

export function ZoomRegistrationCard({
  token,
  firstName,
  email,
  fallbackUrl,
}: {
  token: string;
  firstName: string;
  email: string;
  fallbackUrl: string;
}) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/portal/${token}/zoom-registration`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error(body.error || "Schedule unavailable");
        if (!active) return;
        setMeeting(body.meeting);
        setSelected(body.meeting.occurrences?.[0]?.occurrenceId ?? "");
      })
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : "Schedule unavailable"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token]);

  const needsOccurrence = useMemo(
    () => Boolean(meeting?.occurrences.length && meeting.registrationType !== 1),
    [meeting],
  );

  const register = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/portal/${token}/zoom-registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(needsOccurrence && selected ? { occurrenceId: selected } : {}),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || "Registration failed");
      setJoinUrl(body.joinUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (joinUrl) {
    return (
      <div className="rounded-card border border-success/30 bg-success/5 p-6 text-center sm:p-8">
        <CheckCircle2 className="mx-auto size-11 text-success" aria-hidden="true" />
        <h2 className="mt-4 font-serif text-2xl text-sidebar">You’re registered, {firstName}</h2>
        <p className="mx-auto mt-2 max-w-lg text-base leading-relaxed text-muted-foreground">
          Zoom sent the confirmation and calendar options to <strong className="text-foreground">{email}</strong>.
        </p>
        <a href={joinUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-sidebar px-6 text-sm font-semibold text-white hover:bg-sidebar/90">
          <Video className="size-4" aria-hidden="true" /> View your Zoom link
        </a>
      </div>
    );
  }

  if (!loading && error && !meeting) {
    return (
      <div className="rounded-card border border-border bg-card p-6 text-center shadow-card sm:p-8">
        <CalendarDays className="mx-auto size-10 text-accent-gold" aria-hidden="true" />
        <h2 className="mt-4 font-serif text-2xl text-sidebar">Reserve your spot on Zoom</h2>
        <p className="mx-auto mt-2 max-w-lg text-base leading-relaxed text-muted-foreground">
          Use Zoom’s secure registration page to choose an upcoming CMDT live overview.
        </p>
        <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-sidebar px-6 text-sm font-semibold text-white hover:bg-sidebar/90">
          Open Zoom registration <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-card sm:p-7">
      <div className="flex items-center gap-3 border-b border-border pb-4 text-sidebar">
        <CalendarDays className="size-5 shrink-0 text-accent-gold" aria-hidden="true" />
        <h2 className="font-serif text-xl">Reserve your spot</h2>
      </div>
      {loading ? (
        <div className="flex min-h-40 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" /> Loading upcoming sessions…
        </div>
      ) : (
        <div className="pt-5">
          {meeting?.occurrences.length ? (
            <fieldset>
              <legend className="text-sm font-semibold text-sidebar">
                {needsOccurrence ? "Choose an upcoming session" : "Your registration covers the weekly series"}
              </legend>
              <div className="mt-3 space-y-2">
                {(needsOccurrence ? meeting.occurrences : meeting.occurrences.slice(0, 1)).map((occurrence) => (
                  <label key={occurrence.occurrenceId} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-border px-4 py-3 hover:border-sidebar/35">
                    {needsOccurrence && (
                      <input type="radio" name="occurrence" value={occurrence.occurrenceId} checked={selected === occurrence.occurrenceId} onChange={() => setSelected(occurrence.occurrenceId)} className="size-4 accent-[var(--color-sidebar)]" />
                    )}
                    <span className="text-sm font-medium text-foreground">{sessionLabel(occurrence.startTime)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="text-base text-muted-foreground">Register below for the upcoming CMDT live overview.</p>
          )}
          <div className="mt-5 rounded-md bg-surface px-4 py-3 text-sm text-muted-foreground">
            Registering <strong className="text-foreground">{firstName}</strong> at <strong className="text-foreground">{email}</strong>
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
          <button type="button" onClick={register} disabled={submitting || (needsOccurrence && !selected)} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-sidebar px-6 text-sm font-semibold text-white hover:bg-sidebar/90 disabled:pointer-events-none disabled:opacity-60">
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Video className="size-4" aria-hidden="true" />}
            {submitting ? "Registering…" : "Register for the live overview"}
          </button>
          <p className="mt-3 text-center text-sm text-muted-foreground">Zoom will email your personal link and options for adding the session to your calendar.</p>
        </div>
      )}
    </div>
  );
}
