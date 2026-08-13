"use client";

import { useEffect, useState } from "react";

interface DiagnosticsPayload {
  status: { gtm: string; metaBrowser: string; metaCapi: string };
  lastEvents: { portalEvent: string | null; metaBrowserEvent: string | null; metaServerEvent: string | null };
  counts: {
    eventsToday: number;
    serverEventsFailedToday: number;
    browserEventsFailedToday: number;
    deduplicatedEvents: number;
  };
  log: Array<{
    id: string;
    timestamp: string;
    prospect: string;
    portalEvent: string;
    eventId: string;
    provider: string;
    status: string;
    responseCode: number | null;
  }>;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

const STATUS_STYLES: Record<string, string> = {
  sent: "bg-green-50 text-green-800",
  test: "bg-blue-50 text-blue-800",
  failed: "bg-red-50 text-red-800",
  suppressed: "bg-amber-50 text-amber-800",
  skipped: "bg-gray-100 text-gray-600",
};

/** Tracking Diagnostics tab (spec §14) — provider status, recent events, and the delivery log. Never renders access tokens. */
export function TrackingDiagnostics({ authHeaders }: { authHeaders: Record<string, string> }) {
  const [data, setData] = useState<DiagnosticsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/admin/tracking/diagnostics", { headers: authHeaders });
        const json = await response.json();
        if (cancelled) return;
        if (!json.success) {
          setError(json.error ?? "Could not load diagnostics.");
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) setError("Could not load diagnostics.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">{error}</p>;
  if (!data) return <p className="text-xs text-gray-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900">Provider Status</h3>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <div>
            <dt className="text-gray-500">GTM</dt>
            <dd className="font-medium text-gray-900">{data.status.gtm.replace("_", " ")}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Meta Browser</dt>
            <dd className="font-medium text-gray-900">{data.status.metaBrowser.replace("_", " ")}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Meta CAPI</dt>
            <dd className="font-medium text-gray-900">{data.status.metaCapi.replace("_", " ")}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900">Last Events</h3>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <div>
            <dt className="text-gray-500">Last Portal Event</dt>
            <dd className="font-medium text-gray-900">{formatDateTime(data.lastEvents.portalEvent)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Last Meta Browser Event</dt>
            <dd className="font-medium text-gray-900">{formatDateTime(data.lastEvents.metaBrowserEvent)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Last Meta Server Event</dt>
            <dd className="font-medium text-gray-900">{formatDateTime(data.lastEvents.metaServerEvent)}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900">Today</h3>
        <dl className="mt-3 grid grid-cols-4 gap-3 text-xs">
          <div>
            <dt className="text-gray-500">Events Today</dt>
            <dd className="font-medium text-gray-900">{data.counts.eventsToday}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Server Events Failed</dt>
            <dd className="font-medium text-gray-900">{data.counts.serverEventsFailedToday}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Browser Events Failed</dt>
            <dd className="font-medium text-gray-900">{data.counts.browserEventsFailedToday}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Deduplicated Events</dt>
            <dd className="font-medium text-gray-900">{data.counts.deduplicatedEvents}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900">Event Log</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-1.5 pr-3 font-medium">Timestamp</th>
                <th className="py-1.5 pr-3 font-medium">Prospect</th>
                <th className="py-1.5 pr-3 font-medium">Portal Event</th>
                <th className="py-1.5 pr-3 font-medium">Event ID</th>
                <th className="py-1.5 pr-3 font-medium">Provider</th>
                <th className="py-1.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.log.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-3 text-gray-500">
                    No delivery events yet.
                  </td>
                </tr>
              ) : (
                data.log.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-1.5 pr-3 text-gray-600">{new Date(row.timestamp).toLocaleString()}</td>
                    <td className="py-1.5 pr-3 text-gray-800">{row.prospect}</td>
                    <td className="py-1.5 pr-3 font-mono text-[11px] text-gray-800">{row.portalEvent}</td>
                    <td className="py-1.5 pr-3 font-mono text-[11px] text-gray-500">{row.eventId}</td>
                    <td className="py-1.5 pr-3 text-gray-600">{row.provider}</td>
                    <td className="py-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[row.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
