"use client";

import { useState } from "react";
import { CheckCircle2, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTimeInZone, formatDateInZone } from "@/lib/fdd/format";
import type { FddStatus } from "@/types/fdd";

export interface FddSnapshot {
  status: FddStatus;
  requestedAt: string | null;
  receivedAt: string | null;
  eligibleAt: string | null;
}

interface FddRequestCardProps {
  token: string;
  initial: FddSnapshot;
  timeZone: string;
  advisorName: string;
}

/**
 * Franchise Disclosure Document section of the completion page. Walks the
 * prospect from request → confirmation → waiting period → eligibility.
 */
export function FddRequestCard({ token, initial, timeZone, advisorName }: FddRequestCardProps) {
  const [fdd, setFdd] = useState<FddSnapshot>(initial);
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requested = fdd.status !== "not_requested";

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

  // Waiting period and eligibility take over the card once acknowledged.
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
        <CardContent className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <CheckCircle2 className="size-5 text-success" />
            {eligibilityReached ? "Waiting period completed" : "FDD acknowledgment received"}
          </h2>
          {fdd.receivedAt && (
            <p className="text-sm text-muted-foreground">
              Received: {formatDateTimeInZone(fdd.receivedAt, timeZone)}
            </p>
          )}
          {eligibilityReached ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              You may now proceed to the franchise agreement stage. {advisorName} will contact you
              regarding the next steps.
            </p>
          ) : (
            <>
              {fdd.eligibleAt && (
                <p className="text-sm text-muted-foreground">
                  Franchise agreement eligibility date: {formatDateInZone(fdd.eligibleAt, timeZone)}
                </p>
              )}
              <p className="text-sm font-medium text-foreground">Waiting period in progress</p>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  if (requested) {
    return (
      <Card>
        <CardContent className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <CheckCircle2 className="size-5 text-success" />
            Your FDD has been requested
          </h2>
          {fdd.requestedAt && (
            <p className="text-sm text-muted-foreground">
              Your request was submitted on {formatDateTimeInZone(fdd.requestedAt, timeZone)}.
            </p>
          )}
          <p className="text-sm leading-relaxed text-muted-foreground">
            You will receive an email with instructions to review and acknowledge the document.
            {" "}{advisorName} will be available to answer questions throughout the review process.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <FileText className="size-5 text-primary" />
          Review the Franchise Disclosure Document
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Request the Franchise Disclosure Document to continue your evaluation of this franchise
          opportunity. Once requested, the document will be sent to you for electronic review and
          acknowledgment.
        </p>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={consented}
            onChange={(event) => setConsented(event.target.checked)}
            className="mt-0.5 size-5 rounded border-border text-primary focus:ring-primary/30"
          />
          <span className="text-sm text-foreground">
            I confirm that my contact information is accurate and consent to receiving the
            Franchise Disclosure Document electronically.
          </span>
        </label>

        {error && (
          <div
            role="alert"
            className="rounded-control border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <Button
          type="button"
          size="lg"
          disabled={!consented || submitting}
          onClick={submitRequest}
          className="w-full sm:w-auto"
        >
          {submitting && <Loader2 className="animate-spin" />}
          {submitting ? "Submitting…" : "Request the FDD"}
        </Button>
      </CardContent>
    </Card>
  );
}
