"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface CalendarEmbedProps {
  embedUrl: string | null;
  token: string;
  prefill: {
    name: string;
    email: string;
    phone: string | null;
    leadId: string;
  };
  supportEmail: string;
}

/**
 * Provider-agnostic calendar embed. Any iframe-compatible scheduler works
 * (Calendly, HighLevel, Cal.com, …). Booking is detected from the widget's
 * postMessage events where the provider supports it (Calendly and Cal.com
 * do); a manual confirmation button remains as the temporary fallback the
 * spec allows.
 */
export function CalendarEmbed({ embedUrl, token, prefill, supportEmail }: CalendarEmbedProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const src = embedUrl ? buildEmbedUrl(embedUrl, prefill) : null;

  useEffect(() => {
    async function recordBooking(payload: {
      appointmentId?: string;
      appointmentStartAt?: string;
      detectedVia: "embed-event" | "manual-confirm";
    }) {
      try {
        const response = await fetch(`/api/portal/${token}/booking`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await response.json()) as { success: boolean; nextUrl?: string };
        if (data.success && data.nextUrl) {
          router.push(data.nextUrl);
          router.refresh();
        }
      } catch {
        // Manual confirm button remains available if detection fails.
      }
    }

    function onMessage(event: MessageEvent) {
      // Calendly: { event: "calendly.event_scheduled", payload: { event: { uri }, invitee: { uri } } }
      const data = event.data as
        | { event?: string; payload?: { event?: { uri?: string } } }
        | undefined;
      if (data?.event === "calendly.event_scheduled") {
        void recordBooking({
          appointmentId: data.payload?.event?.uri,
          detectedVia: "embed-event",
        });
        return;
      }
      // Cal.com: { type: "CAL::bookingSuccessful", data: { ... } } (namespaced under cal:: prefixes)
      const calData = event.data as { type?: string } | undefined;
      if (typeof calData?.type === "string" && /bookingSuccessful/i.test(calData.type)) {
        void recordBooking({ detectedVia: "embed-event" });
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router, token]);

  async function handleManualConfirm() {
    setConfirming(true);
    setError(null);
    try {
      const response = await fetch(`/api/portal/${token}/booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ detectedVia: "manual-confirm" }),
      });
      const data = (await response.json()) as { success: boolean; nextUrl?: string; error?: string };
      if (data.success && data.nextUrl) {
        router.push(data.nextUrl);
        router.refresh();
        return;
      }
      setError(data.error ?? "We could not record your booking. Please try again.");
      setConfirming(false);
    } catch {
      setError("We could not record your booking. Please check your connection and try again.");
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-4">
      {src ? (
        <iframe
          src={src}
          title="Schedule your consultation"
          className="h-[720px] w-full rounded-xl border border-line bg-white"
          allow="camera; microphone; fullscreen"
        />
      ) : (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white p-6 text-center">
          <p className="text-sm font-medium text-ink">Calendar not configured</p>
          <p className="mt-2 max-w-sm text-sm text-ink-muted">
            Set <code className="rounded bg-surface px-1">NEXT_PUBLIC_CALENDAR_EMBED_URL</code> to
            embed the scheduling calendar, or contact{" "}
            <a className="underline" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>{" "}
            to schedule directly.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-line bg-white p-5">
        <p className="text-sm text-ink-muted">
          Already picked a time? If this page doesn&apos;t update automatically after booking,
          confirm below.
        </p>
        {error && (
          <p className="mt-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={handleManualConfirm}
          disabled={confirming}
          className="mt-3 rounded-lg border border-brand px-5 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white disabled:opacity-60"
        >
          {confirming ? "Confirming…" : "I Scheduled My Consultation"}
        </button>
      </div>
    </div>
  );
}

/** Passes lead details to the embed so the prospect doesn't re-enter them. */
function buildEmbedUrl(base: string, prefill: CalendarEmbedProps["prefill"]): string {
  try {
    const url = new URL(base);
    // Calendly prefill params; harmless extras for other providers.
    url.searchParams.set("name", prefill.name);
    url.searchParams.set("email", prefill.email);
    if (prefill.phone) url.searchParams.set("phone", prefill.phone);
    // Tracking identifiers supported by Calendly (utm_content) and readable elsewhere.
    url.searchParams.set("utm_source", "investor-portal");
    url.searchParams.set("utm_content", prefill.leadId);
    url.searchParams.set("embed_domain", typeof window !== "undefined" ? window.location.hostname : "");
    url.searchParams.set("embed_type", "Inline");
    return url.toString();
  } catch {
    return base;
  }
}
