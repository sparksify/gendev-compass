"use client";

import { useEffect, useState } from "react";
import type { PortalEventName } from "@/types/analytics";

/**
 * /admin/tracking sections. Same pattern as components/adminSections/AdminSections.tsx:
 * self-contained "use client" sections, local state, fetch on mount, POST on
 * save. See docs/tracking-attribution.md for the underlying architecture.
 */

interface TrackingSettingsPayload {
  gtmEnabled: boolean;
  gtmContainerId: string | null;
  gtmStatus: "connected" | "not_configured" | "configuration_error";
  metaEnabled: boolean;
  metaBrowserMode: "gtm" | "direct" | "server_only";
  metaPixelId: string | null;
  metaBrowserStatus: "connected" | "not_configured";
  metaCapiEnabled: boolean;
  metaCapiAccessTokenConfigured: boolean;
  metaCapiStatus: "connected" | "not_configured" | "configuration_error";
  metaTestEventCode: string | null;
  consentRequired: boolean;
  marketingTrackingDefault: "granted" | "denied";
  eventOverrides: Record<string, { gtm?: boolean; metaBrowser?: boolean; metaCapi?: boolean; metaEventName?: string | null }>;
  lastGtmTestAt: string | null;
  lastMetaBrowserTestAt: string | null;
  lastMetaCapiSuccessAt: string | null;
  lastMetaCapiFailureAt: string | null;
  lastMetaCapiError: string | null;
}

interface TaxonomyRow {
  eventName: PortalEventName;
  tier: number;
  gtm: boolean;
  metaBrowser: boolean;
  metaCapi: boolean;
  metaEventName: string | null;
  overridden: boolean;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    connected: "bg-green-50 text-green-800",
    not_configured: "bg-gray-100 text-gray-600",
    configuration_error: "bg-red-50 text-red-800",
  };
  const labels: Record<string, string> = {
    connected: "Connected",
    not_configured: "Not Configured",
    configuration_error: "Configuration Error",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[status] ?? "bg-gray-100 text-gray-600"}`}>
      {labels[status] ?? status}
    </span>
  );
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

export function TrackingAdminSections({ authHeaders }: { authHeaders: Record<string, string> }) {
  const [settings, setSettings] = useState<TrackingSettingsPayload | null>(null);
  const [taxonomy, setTaxonomy] = useState<TaxonomyRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [encryptionAvailable, setEncryptionAvailable] = useState(true);
  const [metaCapiToken, setMetaCapiToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState<string | null>(null);

  async function load() {
    try {
      const response = await fetch("/api/admin/tracking", { headers: authHeaders });
      const data = await response.json();
      if (!data.success) {
        setError(data.error ?? "Could not load tracking settings.");
        return;
      }
      setError(null);
      setSettings(data.settings);
      setTaxonomy(data.taxonomy ?? []);
      setWarnings(data.warnings ?? []);
      setEncryptionAvailable(data.encryptionAvailable ?? true);
    } catch {
      setError("Could not load tracking settings.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function patch(fields: Partial<TrackingSettingsPayload>) {
    setSettings((prev) => (prev ? { ...prev, ...fields } : prev));
  }

  function patchOverride(eventName: string, fields: { gtm?: boolean; metaBrowser?: boolean; metaCapi?: boolean; metaEventName?: string }) {
    setTaxonomy((prev) =>
      prev.map((row) => (row.eventName === eventName ? { ...row, ...fields } : row)),
    );
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const eventOverrides: Record<string, unknown> = {};
      for (const row of taxonomy) {
        eventOverrides[row.eventName] = {
          gtm: row.gtm,
          metaBrowser: row.metaBrowser,
          metaCapi: row.metaCapi,
          metaEventName: row.metaEventName,
        };
      }
      const response = await fetch("/api/admin/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          gtmEnabled: settings.gtmEnabled,
          gtmContainerId: settings.gtmContainerId || null,
          metaEnabled: settings.metaEnabled,
          metaBrowserMode: settings.metaBrowserMode,
          metaPixelId: settings.metaPixelId || null,
          metaCapiEnabled: settings.metaCapiEnabled,
          ...(metaCapiToken ? { metaCapiAccessToken: metaCapiToken } : {}),
          metaTestEventCode: settings.metaTestEventCode || null,
          consentRequired: settings.consentRequired,
          marketingTrackingDefault: settings.marketingTrackingDefault,
          eventOverrides,
        }),
      });
      const data = await response.json();
      if (!data.success) {
        setSaveMessage(data.error ?? "Save failed.");
      } else {
        setSaveMessage("Saved.");
        setMetaCapiToken("");
        await load();
      }
    } catch {
      setSaveMessage("Save failed. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  async function disableAll() {
    if (!settings) return;
    if (!window.confirm("Disable GTM, Meta browser tracking, and Meta CAPI?")) return;
    patch({ gtmEnabled: false, metaEnabled: false, metaCapiEnabled: false });
    setSaveMessage("Disabled — click Save to apply.");
  }

  async function runTest(action: "test_gtm" | "test_meta_browser" | "send_meta_capi_test") {
    setTestBusy(action);
    setTestMessage(null);
    try {
      const response = await fetch("/api/admin/tracking/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      setTestMessage(data.message ?? (data.success ? "Test event sent." : (data.error ?? "Test failed.")));
      await load();
    } catch {
      setTestMessage("Test failed. Check your connection.");
    } finally {
      setTestBusy(null);
    }
  }

  if (error) {
    return <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">{error}</p>;
  }
  if (!settings) {
    return <p className="text-xs text-gray-500">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          {warnings.map((w) => (
            <p key={w} className="text-xs text-amber-800">
              ⚠ {w}
            </p>
          ))}
        </div>
      )}

      {/* Google Tag Manager */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Google Tag Manager</h3>
          <StatusBadge status={settings.gtmStatus} />
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={settings.gtmEnabled}
            onChange={(e) => patch({ gtmEnabled: e.target.checked })}
          />
          Enable Google Tag Manager
        </label>
        <input
          type="text"
          value={settings.gtmContainerId ?? ""}
          onChange={(e) => patch({ gtmContainerId: e.target.value })}
          placeholder="GTM-XXXXXXX"
          className="mt-2 w-full max-w-xs rounded-lg border border-gray-300 px-3 py-1.5 text-xs"
        />
        <p className="mt-2 text-[11px] text-gray-400">
          GTM loads on every page automatically once enabled — no code change required. Last test:{" "}
          {formatDateTime(settings.lastGtmTestAt)}
        </p>
        <button
          onClick={() => runTest("test_gtm")}
          disabled={testBusy === "test_gtm"}
          className="mt-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {testBusy === "test_gtm" ? "Testing…" : "Test Installation"}
        </button>
      </div>

      {/* Meta Browser Tracking */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Meta Browser Tracking</h3>
          <StatusBadge status={settings.metaBrowserStatus} />
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={settings.metaEnabled}
            onChange={(e) => patch({ metaEnabled: e.target.checked })}
          />
          Enable Meta Tracking
        </label>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-700">
          {(["gtm", "direct", "server_only"] as const).map((mode) => (
            <label key={mode} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="metaBrowserMode"
                checked={settings.metaBrowserMode === mode}
                onChange={() => patch({ metaBrowserMode: mode })}
              />
              {mode === "gtm" ? "Through Google Tag Manager" : mode === "direct" ? "Direct Pixel Integration" : "Server Only"}
            </label>
          ))}
        </div>
        <input
          type="text"
          value={settings.metaPixelId ?? ""}
          onChange={(e) => patch({ metaPixelId: e.target.value })}
          placeholder="Meta Pixel / Dataset ID"
          className="mt-2 w-full max-w-xs rounded-lg border border-gray-300 px-3 py-1.5 text-xs"
        />
        {settings.metaBrowserMode === "gtm" ? (
          <p className="mt-2 text-[11px] text-gray-500">
            The Pixel is NOT initialized directly. Browser events are provided to GTM through the
            application&apos;s <code>dataLayer</code> (event: <code>portal_event</code>) — configure the Meta
            Pixel tag inside your GTM container.
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-gray-400">Last test: {formatDateTime(settings.lastMetaBrowserTestAt)}</p>
        )}
        <button
          onClick={() => runTest("test_meta_browser")}
          disabled={testBusy === "test_meta_browser"}
          className="mt-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {testBusy === "test_meta_browser" ? "Testing…" : "Test Installation"}
        </button>
      </div>

      {/* Meta Conversions API */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Meta Conversions API</h3>
          <StatusBadge status={settings.metaCapiStatus} />
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={settings.metaCapiEnabled}
            onChange={(e) => patch({ metaCapiEnabled: e.target.checked })}
          />
          Enable Meta Conversions API
        </label>
        <p className="mt-2 text-[11px] text-gray-500">
          Access token: {settings.metaCapiAccessTokenConfigured ? "configured (server-only, never shown)" : "not configured"}
        </p>
        {!encryptionAvailable && (
          <p className="mt-1 text-[11px] text-amber-700">
            TRACKING_ENCRYPTION_KEY is not set — tokens cannot be saved here. Use the META_CAPI_ACCESS_TOKEN
            env var instead, or ask an engineer to set the encryption key.
          </p>
        )}
        <input
          type="password"
          value={metaCapiToken}
          onChange={(e) => setMetaCapiToken(e.target.value)}
          placeholder="Conversions API Access Token (leave blank to keep current)"
          disabled={!encryptionAvailable}
          autoComplete="off"
          className="mt-2 w-full max-w-md rounded-lg border border-gray-300 px-3 py-1.5 text-xs disabled:bg-gray-50"
        />
        <input
          type="text"
          value={settings.metaTestEventCode ?? ""}
          onChange={(e) => patch({ metaTestEventCode: e.target.value })}
          placeholder="Test Event Code (optional)"
          className="mt-2 w-full max-w-xs rounded-lg border border-gray-300 px-3 py-1.5 text-xs"
        />
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-gray-500 sm:grid-cols-2">
          <div>Last successful event: {formatDateTime(settings.lastMetaCapiSuccessAt)}</div>
          <div>Last failed event: {formatDateTime(settings.lastMetaCapiFailureAt)}</div>
        </dl>
        {settings.lastMetaCapiError && (
          <p className="mt-1 rounded bg-red-50 p-2 text-[11px] text-red-800">{settings.lastMetaCapiError}</p>
        )}
        <button
          onClick={() => runTest("send_meta_capi_test")}
          disabled={testBusy === "send_meta_capi_test"}
          className="mt-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {testBusy === "send_meta_capi_test" ? "Sending…" : "Send Test Event"}
        </button>
      </div>

      {/* Consent */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900">Consent</h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Placeholder consent behavior — have legal/privacy counsel review before relying on this for
          jurisdiction-specific compliance.
        </p>
        <label className="mt-3 flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={settings.consentRequired}
            onChange={(e) => patch({ consentRequired: e.target.checked })}
          />
          Require marketing consent before Meta Pixel / advertising tags load
        </label>
        <div className="mt-2 flex gap-3 text-xs text-gray-700">
          {(["denied", "granted"] as const).map((v) => (
            <label key={v} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="marketingDefault"
                checked={settings.marketingTrackingDefault === v}
                onChange={() => patch({ marketingTrackingDefault: v })}
              />
              Default: {v === "granted" ? "Granted" : "Denied"}
            </label>
          ))}
        </div>
      </div>

      {/* Event Mapping */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900">Event Mapping</h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Enable/disable each provider per portal event and set the Meta event name it maps to.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-1.5 pr-3 font-medium">Portal Event</th>
                <th className="py-1.5 pr-3 font-medium">Tier</th>
                <th className="py-1.5 pr-3 font-medium">GTM</th>
                <th className="py-1.5 pr-3 font-medium">Meta Browser</th>
                <th className="py-1.5 pr-3 font-medium">Meta CAPI</th>
                <th className="py-1.5 font-medium">Meta Event</th>
              </tr>
            </thead>
            <tbody>
              {taxonomy.map((row) => (
                <tr key={row.eventName} className="border-b border-gray-100 last:border-0">
                  <td className="py-1.5 pr-3 font-mono text-[11px] text-gray-800">{row.eventName}</td>
                  <td className="py-1.5 pr-3 text-gray-600">{row.tier}</td>
                  <td className="py-1.5 pr-3">
                    <input
                      type="checkbox"
                      checked={row.gtm}
                      onChange={(e) => patchOverride(row.eventName, { gtm: e.target.checked })}
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <input
                      type="checkbox"
                      checked={row.metaBrowser}
                      onChange={(e) => patchOverride(row.eventName, { metaBrowser: e.target.checked })}
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <input
                      type="checkbox"
                      checked={row.metaCapi}
                      onChange={(e) => patchOverride(row.eventName, { metaCapi: e.target.checked })}
                    />
                  </td>
                  <td className="py-1.5">
                    <input
                      type="text"
                      value={row.metaEventName ?? ""}
                      onChange={(e) => patchOverride(row.eventName, { metaEventName: e.target.value })}
                      placeholder="(not sent to Meta)"
                      className="w-40 rounded border border-gray-300 px-2 py-1 text-[11px]"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sticky bottom-4 z-10 flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-md">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={disableAll}
          className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Disable All
        </button>
        {saveMessage && <span className="text-xs text-gray-600">{saveMessage}</span>}
        {testMessage && <span className="text-xs text-gray-600">{testMessage}</span>}
      </div>
    </div>
  );
}
