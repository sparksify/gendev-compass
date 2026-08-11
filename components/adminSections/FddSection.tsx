"use client";

import { useEffect, useState } from "react";

export interface FddLeadSummary {
  id: string;
  name: string;
  email: string;
  fdd_status: string;
  fdd_effective_status: string;
  fdd_requested_at: string | null;
  fdd_sent_at: string | null;
  fdd_received_at: string | null;
  fdd_eligible_at: string | null;
  fdd_provider_envelope_id: string | null;
  fdd_last_error: string | null;
  fdd_retry_count: number;
}

interface FddTimelineEntry {
  id: string;
  event: string;
  source: string;
  actor: string;
  external_event_id: string | null;
  before_values: Record<string, unknown> | null;
  after_values: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
}

export const FDD_STATUS_STYLES: Record<string, string> = {
  request_processing: "bg-amber-50 text-amber-800",
  fdd_sent: "bg-blue-50 text-blue-800",
  fdd_delivered: "bg-blue-50 text-blue-800",
  fdd_received: "bg-green-50 text-green-800",
  waiting_period_active: "bg-green-50 text-green-800",
  eligible_for_agreement: "bg-emerald-50 text-emerald-800",
  error_manual_review: "bg-red-50 text-red-800",
};

function FddLeadRow({ lead, authHeaders }: { lead: FddLeadSummary; authHeaders: Record<string, string> }) {
  const [current, setCurrent] = useState(lead);
  const [timeline, setTimeline] = useState<FddTimelineEntry[] | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadTimeline() {
    if (showTimeline) {
      setShowTimeline(false);
      return;
    }
    setShowTimeline(true);
    if (timeline) return;
    const response = await fetch(`/api/admin/fdd?leadId=${current.id}`, {
      headers: authHeaders,
    });
    const data = (await response.json()) as { success: boolean; timeline?: FddTimelineEntry[] };
    setTimeline(data.timeline ?? []);
  }

  async function resend() {
    if (!window.confirm(`Resend the FDD request for ${current.name}?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/fdd", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ action: "resend", leadId: current.id }),
      });
      const data = (await response.json()) as {
        success: boolean;
        error?: string | null;
        lead?: FddLeadSummary;
      };
      if (data.lead) setCurrent(data.lead);
      setTimeline(null);
      setMessage(data.success ? "Request re-dispatched." : (data.error ?? "Resend failed."));
    } catch {
      setMessage("Resend failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function exportAudit() {
    const payload = JSON.stringify({ lead: current, timeline }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fdd-audit-${current.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">
            {current.name} <span className="font-normal text-gray-500">· {current.email}</span>
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            Requested{" "}
            {current.fdd_requested_at ? new Date(current.fdd_requested_at).toLocaleString() : "—"}
            {current.fdd_retry_count > 0 && ` · ${current.fdd_retry_count} retr${current.fdd_retry_count === 1 ? "y" : "ies"}`}
            {current.fdd_provider_envelope_id && (
              <>
                {" · envelope "}
                <button
                  type="button"
                  className="font-mono underline decoration-dotted"
                  title="Copy envelope ID"
                  onClick={() =>
                    void navigator.clipboard.writeText(current.fdd_provider_envelope_id ?? "")
                  }
                >
                  {current.fdd_provider_envelope_id}
                </button>
              </>
            )}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${FDD_STATUS_STYLES[current.fdd_effective_status] ?? "bg-gray-100 text-gray-700"}`}
        >
          {current.fdd_effective_status.replaceAll("_", " ")}
        </span>
      </div>

      {current.fdd_last_error && (
        <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-800">{current.fdd_last_error}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={loadTimeline}
          className="text-xs font-medium text-blue-600 hover:underline"
        >
          {showTimeline ? "Hide timeline" : "View timeline"}
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={busy}
          className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
        >
          {busy ? "Resending…" : "Resend request"}
        </button>
        {timeline && (
          <button
            type="button"
            onClick={exportAudit}
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            Export audit JSON
          </button>
        )}
        {message && <span className="text-xs text-gray-600">{message}</span>}
      </div>

      {showTimeline && (
        <ol className="mt-3 space-y-1.5 border-l border-gray-200 pl-3">
          {timeline === null ? (
            <li className="text-xs text-gray-500">Loading…</li>
          ) : timeline.length === 0 ? (
            <li className="text-xs text-gray-500">No audit entries.</li>
          ) : (
            timeline.map((entry) => (
              <li key={entry.id} className="text-xs text-gray-700">
                <span className="font-medium">{entry.event.replaceAll("_", " ")}</span>
                {" — "}
                {new Date(entry.created_at).toLocaleString()} · {entry.source} · {entry.actor}
                {entry.error && <span className="text-red-700"> · {entry.error}</span>}
              </li>
            ))
          )}
        </ol>
      )}
    </div>
  );
}

export function FddSection({
  authHeaders,
  hideHeader = false,
}: {
  authHeaders: Record<string, string>;
  /** The dedicated admin page already renders a title — skip the card's own. */
  hideHeader?: boolean;
}) {
  const [leads, setLeads] = useState<FddLeadSummary[] | null>(null);
  const [config, setConfig] = useState<{
    ghlConfigured: boolean;
    webhookSecretConfigured: boolean;
    waitingPeriodDays: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/admin/fdd", {
          headers: authHeaders,
        });
        const data = (await response.json()) as {
          success: boolean;
          leads?: FddLeadSummary[];
          config?: { ghlConfigured: boolean; webhookSecretConfigured: boolean; waitingPeriodDays: number };
          error?: string;
        };
        if (cancelled) return;
        if (data.success) {
          setLeads(data.leads ?? []);
          setConfig(data.config ?? null);
        } else {
          setError(data.error ?? "Could not load FDD requests.");
        }
      } catch {
        if (!cancelled) setError("Could not load FDD requests.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authHeaders]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      {!hideHeader && (
        <>
          <h3 className="text-sm font-semibold text-gray-900">FDD Requests</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Franchise Disclosure Document workflow status, audit timeline, and manual retries.
          </p>
        </>
      )}
      {config && (
        <p className="mt-2 text-xs text-gray-600">
          GoHighLevel: {config.ghlConfigured ? "connected" : "not configured (simulated in dev)"} ·
          Webhook secret: {config.webhookSecretConfigured ? "set" : "not set"} · Waiting period:{" "}
          {config.waitingPeriodDays} days
        </p>
      )}
      {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
      <div className="mt-3 space-y-2">
        {leads === null && !error && <p className="text-xs text-gray-500">Loading…</p>}
        {leads?.length === 0 && <p className="text-xs text-gray-500">No FDD requests yet.</p>}
        {leads?.map((lead) => <FddLeadRow key={lead.id} lead={lead} authHeaders={authHeaders} />)}
      </div>
    </div>
  );
}
