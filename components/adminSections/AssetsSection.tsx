"use client";

import { useEffect, useState } from "react";
import { formatSize } from "./shared";

export interface AssetSlot {
  key: string;
  label: string;
  description: string;
  accept: string[];
  maxBytes: number;
}

export interface SiteAsset {
  key: string;
  url: string;
  filename: string | null;
  content_type: string | null;
  size_bytes: number | null;
  updated_at: string;
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

export function AssetsSection({ authHeaders }: { authHeaders: Record<string, string> }) {
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
    <div className="space-y-4">
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
    </div>
  );
}
