"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileText, MailCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FddCardProps {
  token: string;
  email: string;
  /** Server-known request timestamp, if the FDD was already requested. */
  requestedAt: string | null;
  /** Server-known acknowledgment timestamp (set by the e-sign provider). */
  acknowledgedAt: string | null;
}

/** Resend becomes available this long after a send, per the spec. */
const RESEND_DELAY_MS = 60_000;

/**
 * Franchise Disclosure Document card. The consultation stays the primary
 * action — this card is the next process step, styled as a supporting card.
 *
 * States: not requested → request CTA; requested → sent confirmation with a
 * delayed resend; acknowledged → acknowledgment receipt with the review-
 * period start date (backend data only — no compliance calculations).
 */
export function FddCard({ token, email, requestedAt, acknowledgedAt }: FddCardProps) {
  const [requested, setRequested] = useState(Boolean(requestedAt));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number | null>(
    requestedAt ? new Date(requestedAt).getTime() : null,
  );
  const [resendReady, setResendReady] = useState(false);

  useEffect(() => {
    if (!requested || lastSentAt === null) return;
    const remaining = Math.max(0, lastSentAt + RESEND_DELAY_MS - Date.now());
    if (remaining === 0) {
      setResendReady(true);
      return;
    }
    setResendReady(false);
    const timer = setTimeout(() => setResendReady(true), remaining);
    return () => clearTimeout(timer);
  }, [requested, lastSentAt]);

  async function requestFdd(resend: boolean) {
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/portal/${token}/fdd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resend }),
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (data.success) {
        setRequested(true);
        setLastSentAt(Date.now());
      } else {
        setError(data.error ?? "We couldn't process your request. Please try again.");
      }
    } catch {
      setError("We couldn't process your request. Please check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  if (acknowledgedAt) {
    const acknowledged = new Date(acknowledgedAt);
    return (
      <Card>
        <CardContent>
          <h2 className="flex items-center gap-2 text-[15.5px] font-bold text-foreground">
            <CheckCircle2 className="size-[18px] shrink-0 text-success" />
            FDD Acknowledgment Received
          </h2>
          <p className="mt-3 text-[12.5px] leading-[1.6] text-muted-foreground">
            You acknowledged receipt of the Franchise Disclosure Document on{" "}
            <span className="font-medium text-foreground">
              {acknowledged.toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>{" "}
            at{" "}
            <span className="font-medium text-foreground">
              {acknowledged.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            </span>
            .
          </p>
          <p className="mt-2.5 text-[12.5px] leading-[1.6] text-muted-foreground">
            Your review period began on that date. Continue your review and bring any questions to
            your consultation.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (requested) {
    return (
      <Card>
        <CardContent>
          <h2 className="flex items-center gap-2 text-[15.5px] font-bold text-foreground">
            <MailCheck className="size-[18px] shrink-0 text-success" />
            Your FDD Is on the Way
          </h2>
          <p className="mt-3 text-[12.5px] leading-[1.6] text-muted-foreground">
            We&apos;ve emailed your Franchise Disclosure Document to{" "}
            <span className="break-words font-medium text-foreground">{email}</span>. Follow the
            instructions in the email to acknowledge receipt and begin your review period.
          </p>
          {error && (
            <p className="mt-2.5 text-[12.5px] text-red-700" role="alert">
              {error}
            </p>
          )}
          {resendReady && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3.5"
              onClick={() => void requestFdd(true)}
              disabled={sending}
            >
              {sending ? "Resending…" : "Resend FDD"}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <h2 className="flex items-center gap-2 text-[15.5px] font-bold text-foreground">
          <FileText className="size-[18px] shrink-0 text-primary" />
          Review the Franchise Disclosure Document
        </h2>
        <p className="mt-3 text-[12.5px] leading-[1.6] text-muted-foreground">
          The Franchise Disclosure Document provides detailed information about the franchise
          system, investment, fees, obligations, and operating structure.
        </p>
        <p className="mt-2.5 text-[12.5px] leading-[1.6] text-muted-foreground">
          Request your electronic copy now so you can begin your review while preparing for your
          consultation.
        </p>
        {error && (
          <p className="mt-2.5 text-[12.5px] text-red-700" role="alert">
            {error}
          </p>
        )}
        <Button
          type="button"
          variant="secondary"
          className="mt-4 w-full"
          onClick={() => void requestFdd(false)}
          disabled={sending}
        >
          {sending ? "Sending…" : "Send Me the FDD"}
        </Button>
      </CardContent>
    </Card>
  );
}
