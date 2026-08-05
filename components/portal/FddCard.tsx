"use client";

import { useState } from "react";
import { CheckCircle2, FileText, Loader2, MailCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTimeInZone, formatDateInZone } from "@/lib/fdd/format";
import type { FddStatus } from "@/types/fdd";

export interface FddCardSnapshot {
  status: FddStatus;
  requestedAt: string | null;
  receivedAt: string | null;
  eligibleAt: string | null;
}

interface FddCardProps {
  token: string;
  email: string;
  initial: FddCardSnapshot;
  timeZone: string;
  advisorName: string;
}

/**
 * Franchise Disclosure Document card. The consultation stays the primary
 * action — this card is the next process step, styled as a supporting card.
 *
 * Walks the prospect through the real workflow: consented request →
 * sent confirmation → acknowledgment → waiting period → eligibility.
 * Statuses come from the server-side FDD engine (lib/fdd/workflow.ts);
 * prospects never see integration errors — failed dispatches are routed
 * to the admin team and read as "on the way" here.
 */
export function FddCard({ token, email, initial, timeZone, advisorName }: FddCardProps) {
  const [fdd, setFdd] = useState<FddCardSnapshot>(initial);
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitRequest() {
    if (!consented || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/portal/${token}/fdd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consentConfirmed: true }),
      });
      const data = (await response.json()) as {
        success: boolean;
        fdd?: { status: FddStatus; requestedAt: string | null };
        error?: string;
      };
      if (!data.success || !data.fdd) {
        throw new Error(data.error ?? "Your request could not be submitted. Please try again.");
      }
      setFdd((prev) => ({ ...prev, status: data.fdd!.status, requestedAt: data.fdd!.requestedAt }));
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Your request could not be submitted. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Acknowledgment received: waiting period, then agreement eligibility.
  if (
    fdd.status === "fdd_received" ||
    fdd.status === "waiting_period_active" ||
    fdd.status === "eligible_for_agreement"
  ) {
    const eligibilityReached =
      fdd.status === "eligible_for_agreement" ||
      (fdd.eligibleAt !== null && Date.now() >= new Date(fdd.eligibleAt).getTime());

    return (
      <Card>
        <CardContent>
          <h2 className="flex items-center gap-2 text-[15.5px] font-bold text-foreground">
            <CheckCircle2 className="size-[18px] shrink-0 text-success" />
            {eligibilityReached ? "FDD Waiting Period Completed" : "FDD Acknowledgment Received"}
          </h2>
          {fdd.receivedAt && (
            <p className="mt-3 text-[12.5px] leading-[1.6] text-muted-foreground">
              You acknowledged receipt on{" "}
              <span className="font-medium text-foreground">
                {formatDateTimeInZone(fdd.receivedAt, timeZone)}
              </span>
              . Your review period began on that date.
            </p>
          )}
          {eligibilityReached ? (
            <p className="mt-2.5 text-[12.5px] leading-[1.6] text-muted-foreground">
              You may now proceed to the franchise agreement stage. {advisorName} will contact you
              regarding the next steps.
            </p>
          ) : (
            fdd.eligibleAt && (
              <p className="mt-2.5 text-[12.5px] leading-[1.6] text-muted-foreground">
                Franchise agreement eligibility date:{" "}
                <span className="font-medium text-foreground">
                  {formatDateInZone(fdd.eligibleAt, timeZone)}
                </span>
              </p>
            )
          )}
        </CardContent>
      </Card>
    );
  }

  // Requested (processing, sent, delivered — and dispatch errors, which the
  // admin team handles without alarming the prospect).
  if (fdd.status !== "not_requested") {
    return (
      <Card>
        <CardContent>
          <h2 className="flex items-center gap-2 text-[15.5px] font-bold text-foreground">
            <MailCheck className="size-[18px] shrink-0 text-success" />
            Your FDD Is on the Way
          </h2>
          <p className="mt-3 text-[12.5px] leading-[1.6] text-muted-foreground">
            We&apos;re sending your Franchise Disclosure Document to{" "}
            <span className="break-words font-medium text-foreground">{email}</span>. Follow the
            instructions in the email to acknowledge receipt and begin your review period.
          </p>
          {fdd.requestedAt && (
            <p className="mt-2.5 text-[12.5px] leading-[1.6] text-muted-foreground">
              Requested {formatDateTimeInZone(fdd.requestedAt, timeZone)}.
            </p>
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

        <label className="mt-3.5 flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={consented}
            onChange={(event) => setConsented(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 rounded border-border text-primary focus:ring-primary/30"
          />
          <span className="text-[12px] leading-[1.55] text-secondary-foreground">
            I confirm that my contact information is accurate and consent to receiving the
            Franchise Disclosure Document electronically.
          </span>
        </label>

        {error && (
          <p className="mt-2.5 text-[12.5px] text-red-700" role="alert">
            {error}
          </p>
        )}

        <Button
          type="button"
          variant="secondary"
          className="mt-4 w-full"
          onClick={() => void submitRequest()}
          disabled={!consented || submitting}
        >
          {submitting && <Loader2 className="animate-spin" />}
          {submitting ? "Sending…" : "Send Me the FDD"}
        </Button>
      </CardContent>
    </Card>
  );
}
