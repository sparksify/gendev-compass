"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, Video } from "lucide-react";

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

export function ZoomRegistrationCard({ token, firstName, lastName, email, fallbackUrl }: {
  token: string;
  firstName: string;
  lastName: string;
  email: string;
  fallbackUrl: string;
}) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
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

  const register = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/portal/${token}/zoom-registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredOccurrenceId: selected }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || "Registration failed");
      setJoinUrl(body.joinUrl ?? null);
      setAlreadyRegistered(Boolean(body.alreadyRegistered));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (joinUrl || alreadyRegistered) {
    return (
      <div className="rounded-card border border-success/30 bg-success/5 p-6 text-center sm:p-8">
        <CheckCircle2 className="mx-auto size-11 text-success" aria-hidden="true" />
        <h2 className="mt-4 font-serif text-2xl text-sidebar">You’re registered for Zoom</h2>
        <p className="mx-auto mt-2 max-w-lg text-base leading-relaxed text-muted-foreground">
          {alreadyRegistered ? "This email is already registered for the live overview. " : "Zoom will email your personal link and calendar options to "}
          <strong className="text-foreground">{email}</strong>.
        </p>
        {joinUrl && (
          <a href={joinUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#2D8CFF] px-6 text-sm font-semibold text-white hover:bg-[#2681e5]">
            <Video className="size-4" aria-hidden="true" /> View your Zoom link
          </a>
        )}
      </div>
    );
  }

  if (!loading && error && !meeting) {
    return (
      <div className="rounded-card border border-border bg-card p-6 text-center shadow-card sm:p-8">
        <h2 className="font-serif text-2xl text-sidebar">Choose your live Zoom overview</h2>
        <p className="mx-auto mt-2 max-w-lg text-base leading-relaxed text-muted-foreground">{error}</p>
        <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#2D8CFF] px-6 text-sm font-semibold text-white hover:bg-[#2681e5]">
          Open Zoom registration <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-card sm:p-7">
      <div className="flex items-center gap-3 border-b border-border pb-4 text-sidebar">
        <Video className="size-5 shrink-0 text-[#2D8CFF]" aria-hidden="true" />
        <h2 className="font-serif text-xl">Choose your live Zoom overview</h2>
      </div>
      {loading ? (
        <div className="flex min-h-40 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" /> Loading Zoom sessions…
        </div>
      ) : (
        <div className="pt-5">
          {meeting?.occurrences.length ? (
            <fieldset>
              <legend className="text-sm font-semibold text-sidebar">Select a date and time</legend>
              <div className="mt-3 space-y-2">
                {meeting.occurrences.map((occurrence) => (
                  <label key={occurrence.occurrenceId} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors ${selected === occurrence.occurrenceId ? "border-[#2D8CFF] bg-[#2D8CFF]/5" : "border-border hover:border-[#2D8CFF]/50"}`}>
                    <input type="radio" name="occurrence" value={occurrence.occurrenceId} checked={selected === occurrence.occurrenceId} onChange={() => setSelected(occurrence.occurrenceId)} className="size-4 accent-[#2D8CFF]" />
                    <span className="text-sm font-medium text-foreground">{sessionLabel(occurrence.startTime)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="text-base text-muted-foreground">Register below for the upcoming CMDT live overview.</p>
          )}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-sidebar">First name<input value={firstName} readOnly className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-3 font-normal text-foreground" /></label>
            <label className="text-sm font-semibold text-sidebar">Last name<input value={lastName} readOnly className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-3 font-normal text-foreground" /></label>
            <label className="text-sm font-semibold text-sidebar sm:col-span-2">Email<input value={email} readOnly className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-3 font-normal text-foreground" /></label>
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
          <button type="button" onClick={register} disabled={submitting || (Boolean(meeting?.occurrences.length) && !selected)} className="mt-6 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-md bg-[#2D8CFF] px-6 text-base font-semibold text-white shadow-sm hover:bg-[#2681e5] disabled:pointer-events-none disabled:opacity-60">
            {submitting ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Video className="size-5" aria-hidden="true" />}
            {submitting ? "Registering…" : "Register for Zoom"}
          </button>
          <p className="mt-3 text-center text-sm text-muted-foreground">You’ll receive your personal Zoom link by email.</p>
        </div>
      )}
    </div>
  );
}
