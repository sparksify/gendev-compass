"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * The platform-admin toolset (site assets, FDD workflow, territory data,
 * test leads), shared by the unified /advisor/platform page (staff ADMIN
 * session — pass authHeaders={}) and the legacy standalone /admin page
 * (pass authHeaders={"x-admin-password": ...}). Every API these sections
 * call accepts both credentials (lib/advisor/adminAccess.ts).
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
  authHeaders,
  onUploaded,
}: {
  slot: AssetSlot;
  asset: SiteAsset | undefined;
  authHeaders: Record<string, string>;
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
      headers: authHeaders,
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
        headers: { "Content-Type": "application/json", ...authHeaders },
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
          headers: { "Content-Type": "application/json", ...authHeaders },
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

function ZipDataSection({ authHeaders }: { authHeaders: Record<string, string> }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [polygonBusy, setPolygonBusy] = useState<string | null>(null);
  const [polygonResult, setPolygonResult] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoResult, setDemoResult] = useState<string | null>(null);

  async function runDemographicsImport() {
    setDemoBusy(true);
    setDemoResult(null);
    try {
      const response = await fetch("/api/admin/import-demographics", {
        method: "POST",
        headers: authHeaders,
      });
      const data = await response.json();
      const failedNote =
        data.success && data.failedStates?.length ? ` (retry failed: ${data.failedStates.join(", ")})` : "";
      setDemoResult(
        data.success
          ? `Loaded Census demographics for ${data.withDemographics} of ${data.existingZips} ZIPs (ACS ${data.vintage}).${failedNote}`
          : `Failed: ${data.error ?? response.status}`,
      );
    } catch (error) {
      setDemoResult(`Failed: ${error instanceof Error ? error.message : "network error"}`);
    } finally {
      setDemoBusy(false);
    }
  }

  async function runPolygonSync() {
    setPolygonBusy("all");
    setPolygonResult(null);
    let loaded = 0;
    let written = 0;
    try {
      // The route loads as many states as fit in its time budget and reports
      // what's left; keep calling until the whole country is covered.
      for (let pass = 0; pass < 30; pass++) {
        const response = await fetch("/api/admin/import-polygons", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({}),
        });
        const data = await response.json();
        if (!data.success) {
          setPolygonResult(`Failed: ${data.error ?? response.status}`);
          return;
        }
        loaded += data.loadedStates.length;
        written += data.written;
        if (data.remainingStates.length === 0) {
          setPolygonResult(
            loaded === 0
              ? "All states already covered — nothing to load."
              : `Loaded ${written} boundary shapes across ${loaded} states. Full nationwide coverage.`,
          );
          return;
        }
        setPolygonResult(`Loading… ${data.remainingStates.length} states remaining.`);
      }
      setPolygonResult("Stopped after 30 passes — click again to continue.");
    } catch (error) {
      setPolygonResult(`Failed: ${error instanceof Error ? error.message : "network error"}`);
    } finally {
      setPolygonBusy(null);
    }
  }

  async function runImport() {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/import-zips", {
        method: "POST",
        headers: authHeaders,
      });
      const data = await response.json();
      setResult(
        data.success
          ? `Loaded ${data.written} ZIP codes nationwide.`
          : `Failed: ${data.error ?? response.status}`,
      );
    } catch (error) {
      setResult(`Failed: ${error instanceof Error ? error.message : "network error"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900">Territory ZIP Data</h3>
      <p className="mt-0.5 text-xs text-gray-500">
        Load the nationwide GeoNames ZIP reference (~41k ZIPs: city, state, county,
        coordinates) for the Territory Advisor. Safe to re-run; takes up to a minute.
      </p>
      <button
        onClick={runImport}
        disabled={busy}
        className="mt-3 rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {busy ? "Loading nationwide data…" : "Load Nationwide ZIP Data"}
      </button>
      {result && <p className="mt-2 text-xs text-gray-600">{result}</p>}

      <p className="mt-4 text-xs font-medium text-gray-700">Market demographics (Census ACS)</p>
      <p className="mt-0.5 text-xs text-gray-500">
        Loads real population, households, median income, and 5-year growth for every ZIP
        from the U.S. Census Bureau&apos;s ACS 5-Year data. Powers the Market Analysis panel.
        Safe to re-run; takes up to a minute.
      </p>
      <button
        onClick={runDemographicsImport}
        disabled={demoBusy}
        className="mt-2 rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {demoBusy ? "Loading Census data…" : "Load Census Demographics"}
      </button>
      {demoResult && <p className="mt-2 text-xs text-gray-600">{demoResult}</p>}

      <p className="mt-4 text-xs font-medium text-gray-700">Boundary shapes (nationwide)</p>
      <p className="mt-0.5 text-xs text-gray-500">
        Loads real ZIP boundary polygons for all 50 states + DC from data shipped inside the
        app (no external downloads). One click covers the whole country; already-covered
        states are skipped. The daily cron does this automatically too.
      </p>
      <button
        onClick={runPolygonSync}
        disabled={polygonBusy !== null}
        className="mt-2 rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {polygonBusy ? "Loading boundary shapes…" : "Load All Boundary Shapes"}
      </button>
      {polygonResult && <p className="mt-2 text-xs text-gray-600">{polygonResult}</p>}
    </div>
  );
}

function FddSection({ authHeaders }: { authHeaders: Record<string, string> }) {
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
        {leads?.map((lead) => <FddLeadRow key={lead.id} lead={lead} authHeaders={authHeaders} />)}
      </div>
    </div>
  );
}


function AssetsSection({ authHeaders }: { authHeaders: Record<string, string> }) {
  const [slots, setSlots] = useState<AssetSlot[]>([]);
  const [assets, setAssets] = useState<Record<string, SiteAsset>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/admin/assets", { headers: authHeaders });
        const data = (await response.json()) as {
          success: boolean;
          slots?: AssetSlot[];
          assets?: Record<string, SiteAsset>;
          error?: string;
        };
        if (cancelled) return;
        if (data.success && data.slots) {
          setSlots(data.slots);
          setAssets(data.assets ?? {});
        } else {
          setError(data.error ?? "Could not load assets.");
        }
      } catch {
        if (!cancelled) setError("Could not load assets.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authHeaders]);

  return (
    <>
      {error && <p className="text-xs text-red-700">{error}</p>}
      {slots.map((slot) => (
        <SlotCard
          key={slot.key}
          slot={slot}
          asset={assets[slot.key]}
          authHeaders={authHeaders}
          onUploaded={(asset) => setAssets((prev) => ({ ...prev, [asset.key]: asset }))}
        />
      ))}
    </>
  );
}

/** All platform-admin sections, stacked. */
export function AdminSections({ authHeaders }: { authHeaders: Record<string, string> }) {
  return (
    <div className="space-y-4">
      <AssetsSection authHeaders={authHeaders} />
      <FddSection authHeaders={authHeaders} />
      <ZipDataSection authHeaders={authHeaders} />
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
  );
}
