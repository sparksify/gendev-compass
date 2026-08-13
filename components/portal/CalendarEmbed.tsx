"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { firePortalTrackingResults, type PortalTrackingResult } from "@/lib/tracking/client";

interface CalendarEmbedProps {
  embedUrl: string | null;
  token: string;
  prefill: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    leadId: string;
  };
  advisorName: string;
  advisorPhone: string;
  advisorEmail: string;
}

/** How long the embed may take to load before the calm fallback message appears. */
const LOAD_TIMEOUT_MS = 15_000;

/**
 * Provider-agnostic calendar embed. Any iframe-compatible scheduler works
 * (Calendly, HighLevel, Cal.com, …). Booking is detected from the widget's
 * postMessage events where the provider supports it (Calendly and Cal.com
 * do); a manual confirmation button remains as the temporary fallback the
 * spec allows.
 */
export function CalendarEmbed({
  embedUrl,
  token,
  prefill,
  advisorName,
  advisorPhone,
  advisorEmail,
}: CalendarEmbedProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const slotSelectedRef = useRef(false);

  const src = embedUrl ? buildEmbedUrl(embedUrl, prefill) : null;

  useEffect(() => {
    if (!src || loaded) return;
    const timer = setTimeout(() => setLoadTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [src, loaded]);

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
        const data = (await response.json()) as {
          success: boolean;
          nextUrl?: string;
          tracking?: PortalTrackingResult[];
        };
        if (data.success && data.nextUrl) {
          firePortalTrackingResults(data.tracking ?? []);
          router.push(data.nextUrl);
          router.refresh();
        }
      } catch {
        // Manual confirm button remains available if detection fails.
      }
    }

    function trackSlotSelected() {
      if (slotSelectedRef.current) return;
      slotSelectedRef.current = true;
      void fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, eventName: "consultation_slot_selected" }),
      }).catch(() => undefined);
    }

    function onMessage(event: MessageEvent) {
      // Calendly: { event: "calendly.event_scheduled", payload: { event: { uri }, invitee: { uri } } }
      const data = event.data as
        | { event?: string; payload?: { event?: { uri?: string } } }
        | undefined;
      if (data?.event === "calendly.date_and_time_selected") {
        trackSlotSelected();
        return;
      }
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
      const data = (await response.json()) as {
        success: boolean;
        nextUrl?: string;
        error?: string;
        tracking?: PortalTrackingResult[];
      };
      if (data.success && data.nextUrl) {
        firePortalTrackingResults(data.tracking ?? []);
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

  const contactFallback = (
    <>
      contact {advisorName} directly at {advisorPhone} or{" "}
      <a className="text-primary hover:underline" href={`mailto:${advisorEmail}`}>
        {advisorEmail}
      </a>
    </>
  );

  return (
    <div className="space-y-4">
      {src ? (
        <div className="relative">
          {!loaded && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-card border border-border bg-white"
              role="status"
              aria-live="polite"
            >
              {loadTimedOut ? (
                <p className="max-w-sm px-6 text-center text-sm text-muted-foreground">
                  We couldn&apos;t load the scheduling calendar. Please refresh the page or{" "}
                  {contactFallback}.
                </p>
              ) : (
                <>
                  <span
                    aria-hidden
                    className="size-6 animate-spin rounded-full border-2 border-border border-t-primary"
                  />
                  <p className="text-sm text-muted-foreground">Loading available times…</p>
                </>
              )}
            </div>
          )}
          <iframe
            src={src}
            title="Schedule your consultation"
            onLoad={() => setLoaded(true)}
            className="h-[720px] w-full rounded-card border border-border bg-white"
            allow="camera; microphone; fullscreen"
          />
        </div>
      ) : (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-card border border-dashed border-border bg-white p-6 text-center">
          <p className="text-sm font-medium text-foreground">
            The scheduling calendar is unavailable
          </p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Please refresh the page, or {contactFallback} to schedule your consultation.
          </p>
        </div>
      )}

      <div className="rounded-card border border-border bg-white p-5">
        <p className="text-sm text-muted-foreground">
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
          className="mt-3 rounded-control border border-primary px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground disabled:opacity-60"
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
    const fullName = `${prefill.firstName} ${prefill.lastName}`.trim();
    // Calendly-style prefill params; harmless extras for other providers.
    url.searchParams.set("name", fullName);
    // GoHighLevel-style prefill params.
    url.searchParams.set("first_name", prefill.firstName);
    url.searchParams.set("last_name", prefill.lastName);
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
