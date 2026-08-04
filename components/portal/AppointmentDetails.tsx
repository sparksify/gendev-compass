"use client";

import { useEffect, useState } from "react";

/**
 * Renders appointment details in the visitor's own time zone, which is only
 * known in the browser.
 */
export function AppointmentDetails({ startAt }: { startAt: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <p className="mt-3 text-sm text-ink-muted">Loading appointment details…</p>;
  }

  const appointment = new Date(startAt);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <dl className="mt-3 space-y-2 text-sm text-ink">
      <div className="flex justify-between gap-4">
        <dt className="text-ink-muted">Date</dt>
        <dd className="font-medium">
          {appointment.toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-ink-muted">Time</dt>
        <dd className="font-medium">
          {appointment.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
        </dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-ink-muted">Time Zone</dt>
        <dd className="font-medium">{timeZone}</dd>
      </div>
    </dl>
  );
}
