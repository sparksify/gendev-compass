"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Lightweight admin dashboard: upload the site logo, brand assets, and
 * opportunity documents. Protected by ADMIN_TEST_PASSWORD, verified
 * server-side on every request (same model as /admin/create-lead).
 */

interface AssetSlot {
  key: string;
  label: string;
  description: string;
  accept: string[];
  maxBytes: number;
}

interface SiteAsset {
  key: string;
  url: string;
  filename: string | null;
  content_type: string | null;
  size_bytes: number | null;
  updated_at: string;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function SlotCard({
  slot,
  asset,
  password,
  onUploaded,
}: {
  slot: AssetSlot;
  asset: SiteAsset | undefined;
  password: string;
  onUploaded: (asset: SiteAsset) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isImage = slot.accept.some((type) => type.startsWith("image/"));

  async function directUpload(file: File): Promise<SiteAsset> {
    const form = new FormData();
    form.set("key", slot.key);
    form.set("file", file);
    const response = await fetch("/api/admin/assets", {
      method: "POST",
      headers: { "x-admin-password": password },
      body: form,
    });
    const data = (await response.json()) as { success: boolean; asset?: SiteAsset; error?: string };
    if (!data.success || !data.asset) throw new Error(data.error ?? "Upload failed.");
    return data.asset;
  }

  /** Uploads start the moment a file is chosen — no separate save step. */
  async function upload(file: File) {
    if (file.size > slot.maxBytes) {
      setError(`File is too large (max ${Math.round(slot.maxBytes / (1024 * 1024))} MB).`);
      return;
    }
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      // Authorize, then stream the file straight to storage — large files
      // never pass through the app server.
      const signResponse = await fetch("/api/admin/assets/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({
          key: slot.key,
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });
      const sign = (await signResponse.json()) as {
        success: boolean;
        mode?: "signed" | "direct";
        signedUrl?: string;
        path?: string;
        error?: string;
      };
      if (!sign.success) throw new Error(sign.error ?? "Upload could not be authorized.");

      let asset: SiteAsset;
      if (sign.mode === "signed" && sign.signedUrl && sign.path) {
        const put = await fetch(sign.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!put.ok) throw new Error(`Storage upload failed (${put.status}).`);

        const commitResponse = await fetch("/api/admin/assets/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-password": password },
          body: JSON.stringify({
            key: slot.key,
            path: sign.path,
            filename: file.name,
            contentType: file.type,
          }),
        });
        const commit = (await commitResponse.json()) as {
          success: boolean;
          asset?: SiteAsset;
          error?: string;
        };
        if (!commit.success || !commit.asset) {
          throw new Error(commit.error ?? "Upload could not be recorded.");
        }
        asset = commit.asset;
      } else {
        asset = await directUpload(file);
      }

      onUploaded(asset);
      setDone(true);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Upload failed. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{slot.label}</h3>
          <p className="mt-0.5 text-xs text-gray-500">{slot.description}</p>
        </div>
        {asset && (
          <a
            href={asset.url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-xs font-medium text-blue-600 hover:underline"
          >
            View current
          </a>
        )}
      </div>

      {asset && (
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-gray-50 p-3">
          {isImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.url}
              alt={slot.label}
              className="max-h-12 w-auto max-w-[140px] rounded border border-gray-200 bg-white object-contain p-1"
            />
          )}
          <p className="min-w-0 truncate text-xs text-gray-600">
            {asset.filename ?? asset.url}
            {asset.size_bytes ? ` · ${formatSize(asset.size_bytes)}` : ""}
            {` · updated ${new Date(asset.updated_at).toLocaleString()}`}
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept={slot.accept.join(",")}
          disabled={busy}
          onChange={(e) => {
            const selected = e.target.files?.[0];
            e.target.value = "";
            if (selected) void upload(selected);
          }}
          className="text-xs text-gray-600 file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-50 disabled:opacity-50"
        />
        {busy && <span className="text-xs font-medium text-gray-700">Uploading…</span>}
        {done && !busy && <span className="text-xs font-semibold text-green-700">Saved ✓</span>}
      </div>
      <p className="mt-2 text-[11px] text-gray-400">
        Saves automatically when you choose a file.
      </p>
      {error && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs font-medium text-red-800" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface FddLeadSummary {
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

const FDD_STATUS_STYLES: Record<string, string> = {
  request_processing: "bg-amber-50 text-amber-800",
  fdd_sent: "bg-blue-50 text-blue-800",
  fdd_delivered: "bg-blue-50 text-blue-800",
  fdd_received: "bg-green-50 text-green-800",
  waiting_period_active: "bg-green-50 text-green-800",
  eligible_for_agreement: "bg-emerald-50 text-emerald-800",
  error_manual_review: "bg-red-50 text-red-800",
};

function FddLeadRow({ lead, password }: { lead: FddLeadSummary; password: string }) {
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
      headers: { "x-admin-password": password },
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
        headers: { "Content-Type": "application/json", "x-admin-password": password },
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

function FddSection({ password }: { password: string }) {
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
          headers: { "x-admin-password": password },
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
  }, [password]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900">FDD Requests</h3>
      <p className="mt-0.5 text-xs text-gray-500">
        Franchise Disclosure Document workflow status, audit timeline, and manual retries.
      </p>
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
        {leads?.map((lead) => <FddLeadRow key={lead.id} lead={lead} password={password} />)}
      </div>
    </div>
  );
}

interface ActivationSummary {
  totalActivations: number;
  readyCount: number;
  autoMatchedCount: number;
  lastFourResolvedCount: number;
  autoMatchSuccessRate: number | null;
}

interface ActivationRow {
  id: string;
  brand_slug: string;
  source: string | null;
  status: string;
  last_match_tier: string | null;
  last_candidate_count: number | null;
  last_failure_reason: string | null;
  fallback_attempts: number;
  created_at: string;
  updated_at: string;
}

/**
 * Activation-flow diagnostics (spec: admin/debug view). Read-only summary of
 * automatic-match performance and recent activations — no phone/email/ids.
 */
function ActivationSection({ password }: { password: string }) {
  const [summary, setSummary] = useState<ActivationSummary | null>(null);
  const [activations, setActivations] = useState<ActivationRow[] | null>(null);
  const [timeMatchingEnabled, setTimeMatchingEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/admin/portal-activation", {
          headers: { "x-admin-password": password },
        });
        const data = (await response.json()) as {
          success: boolean;
          summary?: ActivationSummary;
          activations?: ActivationRow[];
          config?: { timeMatchingEnabled: boolean };
          error?: string;
        };
        if (cancelled) return;
        if (data.success) {
          setSummary(data.summary ?? null);
          setActivations(data.activations ?? []);
          setTimeMatchingEnabled(data.config?.timeMatchingEnabled ?? null);
        } else {
          setError(data.error ?? "Could not load activation diagnostics.");
        }
      } catch {
        if (!cancelled) setError("Could not load activation diagnostics.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [password]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900">Facebook Lead Activation</h3>
      <p className="mt-0.5 text-xs text-gray-500">
        Automatic time-based matching performance for the /activate flow (last 100 activations).
      </p>
      {timeMatchingEnabled !== null && (
        <p className="mt-2 text-xs text-gray-600">
          Time-based matching: {timeMatchingEnabled ? "enabled" : "disabled (last-four required)"}
        </p>
      )}
      {summary && (
        <p className="mt-2 text-xs text-gray-600">
          {summary.totalActivations} activations · {summary.autoMatchedCount} auto-matched ·{" "}
          {summary.lastFourResolvedCount} resolved via last-four ·{" "}
          {summary.autoMatchSuccessRate ?? "—"}% auto-match rate
        </p>
      )}
      {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
      <div className="mt-3 max-h-96 space-y-1.5 overflow-y-auto">
        {activations === null && !error && <p className="text-xs text-gray-500">Loading…</p>}
        {activations?.length === 0 && <p className="text-xs text-gray-500">No activations yet.</p>}
        {activations?.map((activation) => (
          <div
            key={activation.id}
            className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700"
          >
            <span className="font-medium">{activation.brand_slug}</span> · {activation.status}
            {activation.last_match_tier ? ` · tier: ${activation.last_match_tier}` : ""}
            {activation.last_candidate_count !== null
              ? ` · candidates: ${activation.last_candidate_count}`
              : ""}
            {activation.last_failure_reason ? ` · ${activation.last_failure_reason}` : ""}
            {activation.fallback_attempts > 0
              ? ` · last-four attempts: ${activation.fallback_attempts}`
              : ""}
            <div className="mt-0.5 text-[11px] text-gray-400">
              created {new Date(activation.created_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<AssetSlot[]>([]);
  const [assets, setAssets] = useState<Record<string, SiteAsset>>({});

  async function load(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/assets", {
        headers: { "x-admin-password": password },
      });
      const data = (await response.json()) as {
        success: boolean;
        slots?: AssetSlot[];
        assets?: Record<string, SiteAsset>;
        error?: string;
      };
      if (data.success && data.slots) {
        setSlots(data.slots);
        setAssets(data.assets ?? {});
        setUnlocked(true);
      } else {
        setError(data.error ?? "Could not load assets.");
      }
    } catch {
      setError("Request failed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-xl font-semibold text-gray-900">Portal Admin</h1>
      <p className="mt-1 text-sm text-gray-500">
        Upload branding and opportunity documents. Changes go live immediately.
      </p>

      {!unlocked ? (
        <form onSubmit={load} className="mt-8 space-y-4">
          <div>
            <label htmlFor="admin-password" className="block text-sm font-medium text-gray-800">
              Admin password
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              autoComplete="off"
            />
          </div>
          {error && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              role="alert"
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
          >
            {loading ? "Loading…" : "Open Dashboard"}
          </button>
        </form>
      ) : (
        <div className="mt-8 space-y-4">
          {slots.map((slot) => (
            <SlotCard
              key={slot.key}
              slot={slot}
              asset={assets[slot.key]}
              password={password}
              onUploaded={(asset) => setAssets((prev) => ({ ...prev, [asset.key]: asset }))}
            />
          ))}

          <FddSection password={password} />

          <ActivationSection password={password} />

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-900">Test Leads</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Generate a personalized portal link for testing or a new prospect.
            </p>
            <Link
              href="/admin/create-lead"
              className="mt-3 inline-block rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Create Test Lead →
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
