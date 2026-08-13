"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CompactCardIcon } from "./CompactCardIcon";
import { formatDateTime } from "@/lib/advisor/format";
import { effectiveFddStatus, FDD_STATUS_LABELS } from "@/lib/fdd/status";
import type { LeadRecord } from "@/types/lead";
import type { FddAuditRecord } from "@/types/fdd";

export function FddStatusCard({
  investorId,
  lead,
  fddAudit,
}: {
  investorId: string;
  lead: LeadRecord;
  fddAudit: FddAuditRecord[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const status = effectiveFddStatus(lead);
  const inFlight = status !== "not_requested" && status !== "error_manual_review";

  async function request() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/advisor/investors/${investorId}/fdd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: inFlight }),
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (!data.success) {
        setMessage(data.error ?? "Request failed.");
        return;
      }
      router.refresh();
    } catch {
      setMessage("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const badgeVariant =
    status === "fdd_received" || status === "waiting_period_active" || status === "eligible_for_agreement"
      ? "success"
      : status === "error_manual_review"
        ? "outline"
        : status === "not_requested"
          ? "neutral"
          : "primary";

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <CompactCardIcon icon={FileText} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">FDD Status</p>
              <Badge variant={badgeVariant} className="mt-1">
                {FDD_STATUS_LABELS[status]}
              </Badge>
            </div>
          </div>
          {status !== "not_requested" && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium text-primary hover:underline">
                Timeline
              </summary>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p>Requested {formatDateTime(lead.fdd_requested_at)}</p>
                <p>Sent {formatDateTime(lead.fdd_sent_at)}</p>
                <p>Received {formatDateTime(lead.fdd_received_at)}</p>
                {lead.fdd_last_error && <p className="text-destructive">{lead.fdd_last_error}</p>}
                {fddAudit.length > 0 && (
                  <ol className="mt-1.5 space-y-1 border-l border-border-soft pl-2.5">
                    {fddAudit.map((entry) => (
                      <li key={entry.id}>
                        {entry.event.replace(/_/g, " ")} · {formatDateTime(entry.created_at)}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </details>
          )}
          {message && <p className="mt-2 text-xs text-destructive">{message}</p>}
        </div>
        <Button variant="secondary" size="sm" className="shrink-0" onClick={request} disabled={busy}>
          {busy ? "Working…" : inFlight ? "Resend FDD" : "Request FDD"}
        </Button>
      </CardContent>
    </Card>
  );
}
