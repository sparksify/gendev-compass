"use client";

import { useCallback, useEffect, useState } from "react";

interface Settings {
  enabled: boolean;
  adAccountId: string | null;
  accessTokenConfigured: boolean;
  timezone: string;
  currency: string;
  attributionWindow: string;
  lastSyncAttemptAt: string | null;
  lastSyncSuccessAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
}

export function MetaReportingConfig() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [encryptionAvailable, setEncryptionAvailable] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/meta-reporting", { cache: "no-store" });
    const data = await response.json();
    if (data.success) {
      setSettings(data.settings);
      setEncryptionAvailable(Boolean(data.encryptionAvailable));
    } else setMessage(data.error ?? "Could not load Meta reporting settings.");
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function act(action: "save" | "test" | "sync") {
    if (!settings) return;
    setBusy(action); setMessage(null);
    try {
      const response = await fetch("/api/admin/meta-reporting", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "save" ? {
            enabled: settings.enabled, adAccountId: settings.adAccountId || null,
            ...(token ? { accessToken: token } : {}), timezone: settings.timezone,
            currency: settings.currency.toUpperCase(), attributionWindow: "account_default",
          } : {}),
        }),
      });
      const data = await response.json();
      setMessage(data.success ? (action === "save" ? "Settings saved." : `${action === "test" ? "Connection verified" : "Sync complete"}: ${data.result?.rows ?? 0} daily ad rows.`) : data.error);
      if (data.success) { setToken(""); await load(); }
    } catch { setMessage("The request failed. Please try again."); }
    finally { setBusy(null); }
  }

  if (!settings) return <div className="rounded-card border border-border bg-card p-5 text-sm text-muted-foreground">Loading Meta reporting configuration…</div>;

  return (
    <section className="rounded-card border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-bold text-foreground">Meta Ads Reporting</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted-foreground">
            Read-only Marketing API connection. The token remains encrypted server-side and is never returned to this browser.
          </p>
        </div>
        <label className="flex items-center gap-2 text-[13px] font-semibold">
          <input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} />
          Enabled
        </label>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-[12px] font-semibold text-muted-foreground">Ad Account ID
          <input className="mt-1 w-full rounded-control border border-border bg-background px-3 py-2 text-sm text-foreground" value={settings.adAccountId ?? ""} onChange={(event) => setSettings({ ...settings, adAccountId: event.target.value })} placeholder="act_123456789" />
        </label>
        <label className="text-[12px] font-semibold text-muted-foreground">Access Token
          <input type="password" autoComplete="off" disabled={!encryptionAvailable} className="mt-1 w-full rounded-control border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50" value={token} onChange={(event) => setToken(event.target.value)} placeholder={settings.accessTokenConfigured ? "Stored securely — enter to replace" : "System-user token with ads_read"} />
        </label>
        <label className="text-[12px] font-semibold text-muted-foreground">Timezone
          <input className="mt-1 w-full rounded-control border border-border bg-background px-3 py-2 text-sm text-foreground" value={settings.timezone} onChange={(event) => setSettings({ ...settings, timezone: event.target.value })} />
        </label>
        <label className="text-[12px] font-semibold text-muted-foreground">Currency
          <input maxLength={3} className="mt-1 w-full rounded-control border border-border bg-background px-3 py-2 text-sm uppercase text-foreground" value={settings.currency} onChange={(event) => setSettings({ ...settings, currency: event.target.value })} />
        </label>
      </div>
      {!encryptionAvailable && <p className="mt-3 text-[12px] font-semibold text-amber-700">Set TRACKING_ENCRYPTION_KEY before saving a reporting token, or configure META_ADS_ACCESS_TOKEN in Vercel.</p>}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void act("save")} disabled={Boolean(busy)} className="rounded-control bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground disabled:opacity-50">{busy === "save" ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => void act("test")} disabled={Boolean(busy)} className="rounded-control border border-border px-4 py-2 text-[13px] font-bold text-foreground disabled:opacity-50">{busy === "test" ? "Testing…" : "Test connection"}</button>
        <button type="button" onClick={() => void act("sync")} disabled={Boolean(busy)} className="rounded-control border border-border px-4 py-2 text-[13px] font-bold text-foreground disabled:opacity-50">{busy === "sync" ? "Syncing…" : "Sync last 30 days"}</button>
        <span className="ml-auto text-[12px] text-muted-foreground">Last successful sync: {settings.lastSyncSuccessAt ? new Date(settings.lastSyncSuccessAt).toLocaleString() : "Never"}</span>
      </div>
      {(message || settings.lastSyncError) && <p className="mt-3 rounded-control bg-surface px-3 py-2 text-[12px] text-foreground">{message || settings.lastSyncError}</p>}
    </section>
  );
}
