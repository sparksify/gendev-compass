"use client";

import { useState } from "react";
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
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isImage = slot.accept.some((type) => type.startsWith("image/"));

  async function directUpload(): Promise<SiteAsset> {
    const form = new FormData();
    form.set("key", slot.key);
    form.set("file", file as File);
    const response = await fetch("/api/admin/assets", {
      method: "POST",
      headers: { "x-admin-password": password },
      body: form,
    });
    const data = (await response.json()) as { success: boolean; asset?: SiteAsset; error?: string };
    if (!data.success || !data.asset) throw new Error(data.error ?? "Upload failed.");
    return data.asset;
  }

  async function upload() {
    if (!file) return;
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
        asset = await directUpload();
      }

      onUploaded(asset);
      setFile(null);
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
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setDone(false);
            setError(null);
          }}
          className="text-xs text-gray-600 file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-50"
        />
        <button
          type="button"
          onClick={upload}
          disabled={!file || busy}
          className="rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {busy ? "Uploading…" : asset ? "Replace" : "Upload"}
        </button>
        {done && <span className="text-xs font-medium text-green-700">Saved ✓</span>}
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
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
