"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Client flow behind the static /start URL (the Facebook lead ad's
 * "View website" button). Polls /api/start until the just-submitted lead
 * arrives, confirms identity by first name, then redirects to the personal
 * portal. Falls back to an email lookup on timeout, "That's not me", or a
 * lost claim race.
 */

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 45_000;

type Phase = "searching" | "confirm" | "email" | "redirecting";

interface Candidate {
  candidateId: string;
  firstName: string;
}

export function StartFlow({ supportEmail }: { supportEmail: string }) {
  const [phase, setPhase] = useState<Phase>("searching");
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Candidates this visitor rejected ("That's not me") — excluded from
  // subsequent polls so their own lead can surface once it arrives.
  const excludedRef = useRef<string[]>([]);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    if (phase !== "searching") return;
    let cancelled = false;
    const startedAt = Date.now();

    const poll = async () => {
      if (cancelled || phaseRef.current !== "searching") return;
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setPhase("email");
        return;
      }
      try {
        const exclude = excludedRef.current.length
          ? `?exclude=${excludedRef.current.join(",")}`
          : "";
        const response = await fetch(`/api/start${exclude}`, { cache: "no-store" });
        if (response.ok) {
          const data = (await response.json()) as Partial<Candidate> & { found?: boolean };
          if (!cancelled && data.found && data.candidateId && data.firstName) {
            setCandidate({ candidateId: data.candidateId, firstName: data.firstName });
            setPhase("confirm");
            return;
          }
        }
      } catch {
        // Transient network failure — keep polling until the timeout.
      }
      if (!cancelled) setTimeout(poll, POLL_INTERVAL_MS);
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [phase]);

  const openPortal = useCallback((portalUrl: string) => {
    setPhase("redirecting");
    window.location.assign(portalUrl);
  }, []);

  const confirmCandidate = useCallback(async () => {
    if (!candidate || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: candidate.candidateId }),
      });
      const data = (await response.json()) as { success?: boolean; portalUrl?: string };
      if (data.success && data.portalUrl) {
        openPortal(data.portalUrl);
        return;
      }
      // Claim race lost or candidate expired — fall back to the email lookup.
      setPhase("email");
    } catch {
      setPhase("email");
    } finally {
      setSubmitting(false);
    }
  }, [candidate, submitting, openPortal]);

  const lookupEmail = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (submitting || !email.trim()) return;
      setSubmitting(true);
      setEmailError(null);
      try {
        const response = await fetch("/api/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = (await response.json()) as {
          success?: boolean;
          portalUrl?: string;
          error?: string;
        };
        if (data.success && data.portalUrl) {
          openPortal(data.portalUrl);
          return;
        }
        setEmailError(data.error ?? "Something went wrong. Please try again.");
      } catch {
        setEmailError("Something went wrong. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [email, submitting, openPortal],
  );

  if (phase === "searching" || phase === "redirecting") {
    return (
      <div className="mt-8 flex flex-col items-center gap-4">
        <span
          className="size-8 animate-spin rounded-full border-2 border-border border-t-primary"
          aria-hidden
        />
        <p className="text-muted-foreground" role="status">
          {phase === "searching"
            ? "Setting up your private portal… this takes just a moment."
            : "Opening your portal…"}
        </p>
        {phase === "searching" ? (
          <Button variant="ghost" size="sm" onClick={() => setPhase("email")}>
            Skip the wait — I&apos;ll enter my email
          </Button>
        ) : null}
      </div>
    );
  }

  if (phase === "confirm" && candidate) {
    return (
      <div className="mt-8 flex flex-col items-center gap-5">
        <p className="text-lg text-foreground">
          You&apos;re <span className="font-semibold">{candidate.firstName}</span>, right?
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Button onClick={confirmCandidate} disabled={submitting} size="lg">
            {submitting ? "Opening…" : "Yes, open my portal"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              excludedRef.current.push(candidate.candidateId);
              setCandidate(null);
              setPhase("searching");
            }}
            disabled={submitting}
          >
            That&apos;s not me
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={lookupEmail} className="mt-8 flex w-full max-w-sm flex-col items-stretch gap-3">
      <label htmlFor="start-email" className="text-sm text-muted-foreground">
        Enter the email you used on the form and we&apos;ll open your portal.
      </label>
      <input
        id="start-email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        className="rounded-control border border-border bg-card px-4 py-3 text-[15px] text-foreground outline-none focus:border-primary"
      />
      {emailError ? <p className="text-sm text-red-600">{emailError}</p> : null}
      <Button type="submit" disabled={submitting} size="lg">
        {submitting ? "Looking up…" : "Open my portal"}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">
        Trouble getting in? We also sent your personal link by email and text, or contact{" "}
        <a className="underline" href={`mailto:${supportEmail}`}>
          {supportEmail}
        </a>
        .
      </p>
    </form>
  );
}
