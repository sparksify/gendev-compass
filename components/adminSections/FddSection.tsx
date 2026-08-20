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

/* Soft bordered pills, per the NexCRM status-badge treatment. */
export const FDD_STATUS_STYLES: Record<string, string> = {
  request_processing: "border-amber-200 bg-amber-50 text-amber-700",
  fdd_sent: "border-blue-200 bg-blue-50 text-blue-700",
  fdd_delivered: "border-blue-200 bg-blue-50 text-blue-700",
  fdd_received: "border-violet-200 bg-violet-50 text-violet-700",
  waiting_period_active: "border-indigo-200 bg-indigo-50 text-indigo-700",
  eligible_for_agreement: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error_manual_review: "border-red-200 bg-red-50 text-red-700",
};

const FALLBACK_STATUS_STYLE = "border-border bg-surface text-secondary-foreground";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

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
    <div className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgb(16_24_40_/_0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
            {initials(current.name) || "?"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{current.name}</p>
            <p className="truncate text-xs text-muted-foreground">{current.email}</p>
          </div>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${FDD_STATUS_STYLES[current.fdd_effective_status] ?? FALLBACK_STATUS_STYLE}`}
        >
          {current.fdd_effective_status.replaceAll("_", " ")}
        </span>
      </div>

      <p className="mt-2.5 text-xs text-muted-foreground">
        Requested{" "}
        {current.fdd_requested_at ? new Date(current.fdd_requested_at).toLocaleString() : "—"}
        {current.fdd_retry_count > 0 && ` · ${current.fdd_retry_count} retr${current.fdd_retry_count === 1 ? "y" : "ies"}`}
        {current.fdd_provider_envelope_id && (
          <>
            {" · envelope "}
            <button
              type="button"
              className="font-mono text-secondary-foreground underline decoration-dotted hover:text-primary"
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

      {current.fdd_last_error && (
        <p className="mt-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {current.fdd_last_error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={loadTimeline}
          className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-surface hover:text-foreground"
        >
          {showTimeline ? "Hide timeline" : "View timeline"}
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={busy}
          className="rounded-lg border border-primary-soft-border bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Resending…" : "Resend request"}
        </button>
        {timeline && (
          <button
            type="button"
            onClick={exportAudit}
            className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            Export audit JSON
          </button>
        )}
        {message && <span className="text-xs text-muted-foreground">{message}</span>}
      </div>

      {showTimeline && (
        <ol className="mt-4 space-y-3 border-l-2 border-border-soft pl-4">
          {timeline === null ? (
            <li className="text-xs text-muted-foreground">Loading…</li>
          ) : timeline.length === 0 ? (
            <li className="text-xs text-muted-foreground">No audit entries.</li>
          ) : (
            timeline.map((entry) => (
              <li key={entry.id} className="relative text-xs text-secondary-foreground">
                <span className="absolute -left-[21.5px] top-1 size-2 rounded-full bg-primary" aria-hidden />
                <span className="font-semibold text-foreground">
                  {entry.event.replaceAll("_", " ")}
                </span>
                <span className="mt-0.5 block text-muted-foreground">
                  {new Date(entry.created_at).toLocaleString()} · {entry.source} · {entry.actor}
                  {entry.error && <span className="text-red-600"> · {entry.error}</span>}
                </span>
              </li>
            ))
          )}
        </ol>
      )}
    </div>
  );
}

/* Small KPI card, per the NexCRM dashboard stat row. */
function StatCard({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={
        accent
          ? "rounded-xl bg-gradient-to-br from-primary to-primary-hover p-4 text-primary-foreground shadow-[0_8px_20px_rgb(37_99_235_/_0.25)]"
          : "rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgb(16_24_40_/_0.05)]"
      }
    >
      <p
        className={`text-[11px] font-medium uppercase tracking-wide ${accent ? "text-primary-foreground/80" : "text-muted-foreground"}`}
      >
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function ConfigChip({ label, ok, okText, badText }: { label: string; ok: boolean; okText: string; badText: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-secondary-foreground">
      <span className={`size-1.5 rounded-full ${ok ? "bg-success" : "bg-warning"}`} aria-hidden />
      {label}: {ok ? okText : badText}
    </span>
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

  const stats = leads
    ? {
        total: leads.length,
        inFlight: leads.filter((l) =>
          ["request_processing", "fdd_sent", "fdd_delivered"].includes(l.fdd_effective_status),
        ).length,
        eligible: leads.filter((l) =>
          ["waiting_period_active", "eligible_for_agreement", "fdd_received"].includes(
            l.fdd_effective_status,
          ),
        ).length,
        errors: leads.filter((l) => l.fdd_effective_status === "error_manual_review").length,
      }
    : null;

  return (
    <div className="space-y-4">
      {!hideHeader && (
        <div>
          <h3 className="text-sm font-bold text-foreground">FDD Requests</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Franchise Disclosure Document workflow status, audit timeline, and manual retries.
          </p>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total requests" value={stats.total} accent />
          <StatCard label="In flight" value={stats.inFlight} />
          <StatCard label="Received / waiting" value={stats.eligible} />
          <StatCard label="Needs review" value={stats.errors} />
        </div>
      )}

      {config && (
        <div className="flex flex-wrap items-center gap-2">
          <ConfigChip
            label="GoHighLevel"
            ok={config.ghlConfigured}
            okText="connected"
            badText="not configured (simulated in dev)"
          />
          <ConfigChip
            label="Webhook secret"
            ok={config.webhookSecretConfigured}
            okText="set"
            badText="not set"
          />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-secondary-foreground">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            Waiting period: {config.waitingPeriodDays} days
          </span>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {leads === null && !error && (
          <p className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground shadow-[0_1px_2px_rgb(16_24_40_/_0.05)]">
            Loading…
          </p>
        )}
        {leads?.length === 0 && (
          <p className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground shadow-[0_1px_2px_rgb(16_24_40_/_0.05)]">
            No FDD requests yet.
          </p>
        )}
        {leads?.map((lead) => <FddLeadRow key={lead.id} lead={lead} authHeaders={authHeaders} />)}
      </div>
    </div>
  );
}
