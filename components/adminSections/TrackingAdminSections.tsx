"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SECONDARY_BUTTON_SM } from "@/components/advisor/controls";
import { SIGNAL } from "@/lib/advisor/discoveryStages";
import type { PortalEventName } from "@/types/analytics";

/**
 * Tracking & Pixels settings (handoff mock 8b): one flat card per provider —
 * title, status pill, toggle, then a row of label/value facts. The facts are
 * the real inputs, styled as text so the card reads as a summary until you
 * click into it. See docs/tracking-attribution.md for the architecture.
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
  eventOverrides: Record<
    string,
    { gtm?: boolean; metaBrowser?: boolean; metaCapi?: boolean; metaEventName?: string | null }
  >;
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

export interface TrackingSettingsApi {
  save: () => void;
  sendTestEvent: () => void;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

/** Small uppercase state pill on a setting card's title row. */
function Pill({ label, tone }: { label: string; tone: "ok" | "warn" | "bad" | "off" }) {
  const colors = {
    ok: { color: SIGNAL.success, tint: SIGNAL.successTint },
    warn: { color: SIGNAL.warning, tint: SIGNAL.warningTint },
    bad: { color: SIGNAL.alert, tint: SIGNAL.alertTint },
    off: { color: SIGNAL.neutral, tint: SIGNAL.neutralTint },
  }[tone];
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em]"
      style={{ color: colors.color, backgroundColor: colors.tint }}
    >
      {label}
    </span>
  );
}

/** 34×19px switch — green when on, per the handoff. */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative h-[19px] w-[34px] shrink-0 rounded-full transition-colors"
      style={{ backgroundColor: checked ? SIGNAL.success : "#d0d5dd" }}
    >
      <span
        className="absolute top-0.5 size-[15px] rounded-full bg-white transition-all"
        style={{ left: checked ? "17px" : "2px" }}
      />
    </button>
  );
}

/** A label/value fact whose value is an input styled as text. */
function FactInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
  width = "w-[150px]",
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  type?: "text" | "password";
  disabled?: boolean;
  width?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] text-faint-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className={`tabular mt-0.5 ${width} max-w-full rounded border border-transparent bg-transparent text-[12.5px] font-bold text-foreground placeholder:font-medium placeholder:text-ghost-foreground hover:border-border focus:border-border-strong focus:outline-none disabled:opacity-60`}
      />
    </label>
  );
}

/** A read-only label/value fact. */
function Fact({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <span className="block">
      <span className="block text-[10px] text-faint-foreground">{label}</span>
      <strong className="text-[12.5px] font-bold" style={color ? { color } : undefined}>
        {value}
      </strong>
    </span>
  );
}

function SettingCard({
  title,
  pill,
  checked,
  onToggle,
  children,
}: {
  title: string;
  pill: React.ReactNode;
  checked: boolean;
  onToggle: (next: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-border px-5 py-4">
      <div className="flex items-center gap-2.5">
        <strong className="text-[13.5px] font-bold text-foreground">{title}</strong>
        {pill}
        <span className="ml-auto">
          <Toggle checked={checked} onChange={onToggle} label={`Enable ${title}`} />
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">{children}</div>
    </div>
  );
}

export function TrackingAdminSections({
  authHeaders,
  onReady,
}: {
  authHeaders: Record<string, string>;
  /** Hands the page header its Save / Send test event actions. */
  onReady?: (api: TrackingSettingsApi) => void;
}) {
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
  const [showEventMap, setShowEventMap] = useState(false);

  const load = useCallback(async () => {
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
    // authHeaders is a fresh object each render; the values never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function patch(fields: Partial<TrackingSettingsPayload>) {
    setSettings((prev) => (prev ? { ...prev, ...fields } : prev));
  }

  function patchOverride(
    eventName: string,
    fields: { gtm?: boolean; metaBrowser?: boolean; metaCapi?: boolean; metaEventName?: string },
  ) {
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

  function disableAll() {
    if (!settings) return;
    if (!window.confirm("Disable GTM, Meta browser tracking, and Meta CAPI?")) return;
    patch({ gtmEnabled: false, metaEnabled: false, metaCapiEnabled: false });
    setSaveMessage("Disabled — save to apply.");
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
      setTestMessage(
        data.message ?? (data.success ? "Test event sent." : (data.error ?? "Test failed.")),
      );
      await load();
    } catch {
      setTestMessage("Test failed. Check your connection.");
    } finally {
      setTestBusy(null);
    }
  }

  // Hand the page header its actions, without it needing this component's state.
  const handlers = useRef({ save, runTest });
  handlers.current = { save, runTest };
  useEffect(() => {
    onReady?.({
      save: () => void handlers.current.save(),
      sendTestEvent: () => void handlers.current.runTest("send_meta_capi_test"),
    });
  }, [onReady]);

  if (error) {
    return (
      <p
        className="rounded-card border px-4 py-3 text-xs"
        style={{ borderColor: "#fda29b", backgroundColor: SIGNAL.alertTint, color: SIGNAL.alert }}
      >
        {error}
      </p>
    );
  }
  if (!settings) return <p className="text-xs text-muted-foreground">Loading…</p>;

  const gtmPill =
    settings.gtmStatus === "connected"
      ? { label: "Enabled", tone: "ok" as const }
      : settings.gtmStatus === "configuration_error"
        ? { label: "Config error", tone: "bad" as const }
        : { label: "Not configured", tone: "off" as const };

  const metaModeLabel =
    settings.metaBrowserMode === "gtm"
      ? "Through GTM"
      : settings.metaBrowserMode === "direct"
        ? "Direct mode"
        : "Server only";

  return (
    <div className="flex flex-col gap-[22px]">
      {warnings.length > 0 && (
        <div
          className="rounded-card border px-4 py-3"
          style={{ borderColor: "#fde68a", backgroundColor: SIGNAL.warningTint }}
        >
          {warnings.map((warning) => (
            <p key={warning} className="text-xs" style={{ color: SIGNAL.warning }}>
              ⚠ {warning}
            </p>
          ))}
        </div>
      )}

      {/* Google Tag Manager */}
      <SettingCard
        title="Google Tag Manager"
        pill={<Pill label={gtmPill.label} tone={gtmPill.tone} />}
        checked={settings.gtmEnabled}
        onToggle={(next) => patch({ gtmEnabled: next })}
      >
        <FactInput
          label="Container ID"
          value={settings.gtmContainerId ?? ""}
          onChange={(value) => patch({ gtmContainerId: value })}
          placeholder="GTM-XXXXXXX"
        />
        <Fact label="dataLayer contract" value="portal_event" />
        <Fact label="Loaded on" value="portal pages only" />
        <span className="flex items-end">
          <button
            type="button"
            onClick={() => runTest("test_gtm")}
            disabled={testBusy === "test_gtm"}
            className={SECONDARY_BUTTON_SM}
          >
            {testBusy === "test_gtm" ? "Testing…" : "Test installation"}
          </button>
        </span>
        <Fact label="Last test" value={formatDateTime(settings.lastGtmTestAt)} />
      </SettingCard>

      {/* Meta Pixel */}
      <SettingCard
        title="Meta Pixel"
        pill={
          <Pill
            label={metaModeLabel}
            tone={settings.metaBrowserStatus === "connected" ? "ok" : "off"}
          />
        }
        checked={settings.metaEnabled}
        onToggle={(next) => patch({ metaEnabled: next })}
      >
        <FactInput
          label="Pixel ID"
          value={settings.metaPixelId ?? ""}
          onChange={(value) => patch({ metaPixelId: value })}
          placeholder="Dataset ID"
        />
        <label className="block">
          <span className="block text-[10px] text-faint-foreground">Browser mode</span>
          <select
            value={settings.metaBrowserMode}
            onChange={(event) =>
              patch({ metaBrowserMode: event.target.value as TrackingSettingsPayload["metaBrowserMode"] })
            }
            className="mt-0.5 rounded border border-transparent bg-transparent text-[12.5px] font-bold text-foreground hover:border-border focus:border-border-strong focus:outline-none"
          >
            <option value="gtm">Through Google Tag Manager</option>
            <option value="direct">Direct pixel integration</option>
            <option value="server_only">Server only</option>
          </select>
        </label>
        <Fact label="Event dedup" value="Browser + server IDs" color={SIGNAL.success} />
        <Fact label="Financial data" value="never sent" />
        <span className="flex items-end">
          <button
            type="button"
            onClick={() => runTest("test_meta_browser")}
            disabled={testBusy === "test_meta_browser"}
            className={SECONDARY_BUTTON_SM}
          >
            {testBusy === "test_meta_browser" ? "Testing…" : "Test installation"}
          </button>
        </span>
      </SettingCard>

      {/* Meta Conversions API */}
      <SettingCard
        title="Meta Conversions API"
        pill={
          <Pill
            label={settings.metaCapiAccessTokenConfigured ? "Token set" : "No token"}
            tone={settings.metaCapiAccessTokenConfigured ? "ok" : "off"}
          />
        }
        checked={settings.metaCapiEnabled}
        onToggle={(next) => patch({ metaCapiEnabled: next })}
      >
        <FactInput
          label="Access token"
          type="password"
          value={metaCapiToken}
          onChange={setMetaCapiToken}
          placeholder={
            settings.metaCapiAccessTokenConfigured ? "•••••••• · server-only" : "not configured"
          }
          disabled={!encryptionAvailable}
          width="w-[200px]"
        />
        <Fact
          label="Last successful event"
          value={formatDateTime(settings.lastMetaCapiSuccessAt)}
          color={settings.lastMetaCapiSuccessAt ? SIGNAL.success : undefined}
        />
        <Fact label="Cron retry" value="hourly · bounded" />
        <FactInput
          label="Test event code"
          value={settings.metaTestEventCode ?? ""}
          onChange={(value) => patch({ metaTestEventCode: value })}
          placeholder="optional"
          width="w-[110px]"
        />
        <span className="flex items-end">
          <button
            type="button"
            onClick={() => runTest("send_meta_capi_test")}
            disabled={testBusy === "send_meta_capi_test"}
            className={SECONDARY_BUTTON_SM}
          >
            {testBusy === "send_meta_capi_test" ? "Sending…" : "Send test event"}
          </button>
        </span>
        {!encryptionAvailable && (
          <p className="w-full text-[11px]" style={{ color: SIGNAL.warning }}>
            TRACKING_ENCRYPTION_KEY is not set — tokens cannot be saved here. Use the
            META_CAPI_ACCESS_TOKEN env var instead, or ask an engineer to set the encryption key.
          </p>
        )}
        {settings.lastMetaCapiError && (
          <p className="w-full text-[11px]" style={{ color: SIGNAL.alert }}>
            Last failure ({formatDateTime(settings.lastMetaCapiFailureAt)}):{" "}
            {settings.lastMetaCapiError}
          </p>
        )}
      </SettingCard>

      {/* Consent */}
      <SettingCard
        title="Consent"
        pill={
          <Pill
            label={settings.consentRequired ? "Banner required" : "No banner"}
            tone={settings.consentRequired ? "warn" : "off"}
          />
        }
        checked={settings.consentRequired}
        onToggle={(next) => patch({ consentRequired: next })}
      >
        <label className="block">
          <span className="block text-[10px] text-faint-foreground">Marketing default</span>
          <select
            value={settings.marketingTrackingDefault}
            onChange={(event) =>
              patch({
                marketingTrackingDefault: event.target
                  .value as TrackingSettingsPayload["marketingTrackingDefault"],
              })
            }
            className="mt-0.5 rounded border border-transparent bg-transparent text-[12.5px] font-bold text-foreground hover:border-border focus:border-border-strong focus:outline-none"
          >
            <option value="denied">Off until accepted</option>
            <option value="granted">On by default</option>
          </select>
        </label>
        <Fact label="Attribution" value="First-touch kept · latest-touch updated" />
        <p className="w-full text-[11px] text-faint-foreground">
          Placeholder consent behavior — have legal/privacy counsel review before relying on this for
          jurisdiction-specific compliance.
        </p>
      </SettingCard>

      {/* Event mapping — not in the mock, but the page can't lose it. */}
      <div className="rounded-card border border-border px-5 py-4">
        <button
          type="button"
          onClick={() => setShowEventMap((open) => !open)}
          aria-expanded={showEventMap}
          className="flex w-full items-center gap-2.5 text-left"
        >
          <strong className="text-[13.5px] font-bold text-foreground">Event mapping</strong>
          <span className="text-[11px] text-faint-foreground">{taxonomy.length} portal events</span>
          <span className="ml-auto text-[11.5px] font-semibold text-foreground underline">
            {showEventMap ? "Hide" : "Edit"}
          </span>
        </button>
        {showEventMap && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[9.5px] font-bold uppercase tracking-[0.12em] text-faint-foreground">
                  <th className="py-2 pr-3">Portal event</th>
                  <th className="py-2 pr-3">Tier</th>
                  <th className="py-2 pr-3">GTM</th>
                  <th className="py-2 pr-3">Meta browser</th>
                  <th className="py-2 pr-3">Meta CAPI</th>
                  <th className="py-2">Meta event</th>
                </tr>
              </thead>
              <tbody>
                {taxonomy.map((row) => (
                  <tr key={row.eventName} className="border-b border-border-soft last:border-0">
                    <td className="py-1.5 pr-3 font-mono text-[11px] text-secondary-foreground">
                      {row.eventName}
                    </td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{row.tier}</td>
                    <td className="py-1.5 pr-3">
                      <input
                        type="checkbox"
                        checked={row.gtm}
                        aria-label={`Send ${row.eventName} to GTM`}
                        onChange={(e) => patchOverride(row.eventName, { gtm: e.target.checked })}
                      />
                    </td>
                    <td className="py-1.5 pr-3">
                      <input
                        type="checkbox"
                        checked={row.metaBrowser}
                        aria-label={`Send ${row.eventName} to Meta browser`}
                        onChange={(e) =>
                          patchOverride(row.eventName, { metaBrowser: e.target.checked })
                        }
                      />
                    </td>
                    <td className="py-1.5 pr-3">
                      <input
                        type="checkbox"
                        checked={row.metaCapi}
                        aria-label={`Send ${row.eventName} to Meta CAPI`}
                        onChange={(e) => patchOverride(row.eventName, { metaCapi: e.target.checked })}
                      />
                    </td>
                    <td className="py-1.5">
                      <input
                        type="text"
                        value={row.metaEventName ?? ""}
                        aria-label={`Meta event name for ${row.eventName}`}
                        onChange={(e) =>
                          patchOverride(row.eventName, { metaEventName: e.target.value })
                        }
                        placeholder="(not sent to Meta)"
                        className="w-40 rounded border border-border px-2 py-1 text-[11px]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={disableAll} className={SECONDARY_BUTTON_SM}>
          Disable all
        </button>
        {(saving || saveMessage) && (
          <span className="text-[11.5px] text-muted-foreground">
            {saving ? "Saving…" : saveMessage}
          </span>
        )}
        {testMessage && <span className="text-[11.5px] text-muted-foreground">{testMessage}</span>}
      </div>
    </div>
  );
}
