"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/config/brand";

interface ActivationScreenProps {
  brandSlug: string | null;
  formId: string | null;
  campaignId: string | null;
  adId: string | null;
  pageId: string | null;
  source: string | null;
  pollIntervalMs: number;
  maxWaitSeconds: number;
}

type Phase = "starting" | "pending" | "fallback" | "resolving" | "ready" | "expired" | "error";

const ROTATING_MESSAGES = [
  "Locating your request…",
  "Creating your profile…",
  "Preparing your opportunity dashboard…",
  "Almost ready…",
];

interface StartResponse {
  activationId?: string;
  status?: string;
  error?: string;
}

interface StatusResponse {
  status: "pending" | "fallback_required" | "ready" | "expired" | "error";
  fallbackType?: "phone_last_four";
  redirectUrl?: string;
  error?: string;
}

interface LastFourResponse {
  status: "ready" | "fallback_required" | "manual_resolution_required" | "expired" | "error";
  redirectUrl?: string;
}

export function ActivationScreen({
  brandSlug,
  formId,
  campaignId,
  adId,
  pageId,
  source,
  pollIntervalMs,
  maxWaitSeconds,
}: ActivationScreenProps) {
  const [phase, setPhase] = useState<Phase>(brandSlug ? "starting" : "error");
  const [messageIndex, setMessageIndex] = useState(0);
  const [lastFour, setLastFour] = useState("");
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);

  // Rotate the reassuring progress copy while we're actively working.
  useEffect(() => {
    if (phase !== "starting" && phase !== "pending") return;
    const id = setInterval(() => {
      setMessageIndex((index) => (index + 1) % ROTATING_MESSAGES.length);
    }, 2600);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (!brandSlug) return;
    stoppedRef.current = false;

    async function begin() {
      try {
        const response = await fetch("/api/portal-activation/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandSlug,
            formId: formId ?? undefined,
            campaignId: campaignId ?? undefined,
            adId: adId ?? undefined,
            pageId: pageId ?? undefined,
            source: source ?? undefined,
          }),
        });
        const data = (await response.json()) as StartResponse;
        if (!response.ok || !data.activationId) {
          if (!stoppedRef.current) setPhase("error");
          return;
        }
        startedAtRef.current = Date.now();
        if (!stoppedRef.current) {
          setPhase("pending");
          poll();
        }
      } catch {
        if (!stoppedRef.current) setPhase("error");
      }
    }

    async function poll() {
      if (stoppedRef.current) return;
      try {
        const response = await fetch("/api/portal-activation/status", { cache: "no-store" });
        const data = (await response.json()) as StatusResponse;

        if (data.status === "ready" && data.redirectUrl) {
          setRedirectUrl(data.redirectUrl);
          setPhase("ready");
          window.setTimeout(() => {
            window.location.href = data.redirectUrl as string;
          }, 900);
          return;
        }
        if (data.status === "fallback_required") {
          setPhase("fallback");
          return;
        }
        if (data.status === "expired") {
          setPhase("expired");
          return;
        }

        const elapsedMs = Date.now() - (startedAtRef.current ?? Date.now());
        // Client-side safety net: never poll forever even if the server
        // stays "pending" longer than expected.
        if (elapsedMs > (maxWaitSeconds + 15) * 1000) {
          setPhase("fallback");
          return;
        }

        pollTimerRef.current = setTimeout(poll, pollIntervalMs);
      } catch {
        pollTimerRef.current = setTimeout(poll, pollIntervalMs);
      }
    }

    begin();
    return () => {
      stoppedRef.current = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [brandSlug, formId, campaignId, adId, pageId, source, pollIntervalMs, maxWaitSeconds]);

  async function submitLastFour(event: React.FormEvent) {
    event.preventDefault();
    setFallbackError(null);
    if (!/^\d{4}$/.test(lastFour)) {
      setFallbackError("Enter exactly four digits.");
      return;
    }
    setPhase("resolving");
    try {
      const response = await fetch("/api/portal-activation/phone-last-four", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneLastFour: lastFour }),
      });
      const data = (await response.json()) as LastFourResponse;

      if (data.status === "ready" && data.redirectUrl) {
        setRedirectUrl(data.redirectUrl);
        setPhase("ready");
        window.setTimeout(() => {
          window.location.href = data.redirectUrl as string;
        }, 900);
        return;
      }
      if (data.status === "expired") {
        setPhase("expired");
        return;
      }
      if (data.status === "manual_resolution_required") {
        setFallbackError(
          "We need one more detail to locate the correct request. Please contact our team for help.",
        );
        setPhase("fallback");
        return;
      }
      // fallback_required (no_match) or anything else: let them retry.
      setFallbackError(
        "We couldn't locate your recent request. Please make sure you entered the same phone number used on the Facebook form.",
      );
      setPhase("fallback");
    } catch {
      setFallbackError("Something went wrong. Please try again.");
      setPhase("fallback");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-16 sm:px-6">
      <img src={brand.logoPath} alt={brand.brandName} className="mb-8 h-8 w-auto" />
      <Card className="w-full">
        <CardContent className="flex flex-col items-center p-7 text-center sm:p-8">
          {(phase === "starting" || phase === "pending" || phase === "resolving") && (
            <>
              <Spinner />
              <h1 className="mt-5 font-serif text-2xl font-normal text-foreground">
                Creating Your Private Portal
              </h1>
              <p className="mt-3 text-[13.5px] leading-[1.65] text-muted-foreground">
                We&apos;re locating your information and preparing your personalized opportunity
                dashboard. This usually takes only a few seconds.
              </p>
              <p className="mt-4 text-[12.5px] font-medium text-primary">
                {ROTATING_MESSAGES[messageIndex]}
              </p>
            </>
          )}

          {phase === "fallback" && (
            <>
              <h1 className="font-serif text-2xl font-normal text-foreground">One quick step</h1>
              <p className="mt-3 text-[13.5px] leading-[1.65] text-muted-foreground">
                Enter the last four digits of the phone number you used so we can open the correct
                portal.
              </p>
              <form onSubmit={submitLastFour} className="mt-5 w-full">
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  autoFocus
                  value={lastFour}
                  onChange={(event) => setLastFour(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                  aria-label="Last four digits of your phone number"
                  className="w-full rounded-control border border-border bg-card px-4 py-3 text-center text-2xl tracking-[0.5em] text-foreground outline-none focus-visible:border-primary"
                />
                {fallbackError && (
                  <p className="mt-2 text-[12.5px] text-destructive">{fallbackError}</p>
                )}
                <Button type="submit" className="mt-4 w-full" disabled={lastFour.length !== 4}>
                  Open My Portal
                </Button>
              </form>
            </>
          )}

          {phase === "ready" && (
            <>
              <Spinner />
              <h1 className="mt-5 font-serif text-2xl font-normal text-foreground">
                Your portal is ready.
              </h1>
              <p className="mt-3 text-[13.5px] leading-[1.65] text-muted-foreground">
                Opening your private dashboard…
              </p>
              {redirectUrl && (
                <a href={redirectUrl} className="mt-4 text-[12.5px] font-medium text-primary">
                  Continue if you&apos;re not redirected automatically
                </a>
              )}
            </>
          )}

          {phase === "expired" && (
            <>
              <h1 className="font-serif text-2xl font-normal text-foreground">
                This activation has expired
              </h1>
              <p className="mt-3 text-[13.5px] leading-[1.65] text-muted-foreground">
                Please go back to Facebook and click &ldquo;Create My Private Portal&rdquo; again, or
                contact our team for assistance.
              </p>
              <a
                href={`mailto:${brand.supportEmail}`}
                className="mt-5 inline-block rounded-control bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
              >
                Contact Support
              </a>
            </>
          )}

          {phase === "error" && (
            <>
              <h1 className="font-serif text-2xl font-normal text-foreground">
                We couldn&apos;t start your portal
              </h1>
              <p className="mt-3 text-[13.5px] leading-[1.65] text-muted-foreground">
                Something isn&apos;t right with this link. Please contact our team for assistance.
              </p>
              <a
                href={`mailto:${brand.supportEmail}`}
                className="mt-5 inline-block rounded-control bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
              >
                Contact Support
              </a>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="size-9 animate-spin rounded-full border-[3px] border-primary-soft-border border-t-primary"
      aria-hidden
    />
  );
}
