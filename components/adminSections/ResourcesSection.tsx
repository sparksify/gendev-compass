"use client";

import { useEffect, useState } from "react";
import { formatSize } from "./shared";

export interface Resource {
  id: string;
  title: string;
  description: string | null;
  url: string;
  filename: string | null;
  content_type: string | null;
  size_bytes: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function ResourceRow({
  resource,
  authHeaders,
  onUpdated,
  onDeleted,
}: {
  resource: Resource;
  authHeaders: Record<string, string>;
  onUpdated: (resource: Resource) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(resource.title);
  const [description, setDescription] = useState(resource.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) {
      setError("Title cannot be empty.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/resources/${resource.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ title: title.trim(), description }),
      });
      const data = (await response.json()) as { success: boolean; resource?: Resource; error?: string };
      if (!data.success || !data.resource) throw new Error(data.error ?? "Update failed.");
      onUpdated(data.resource);
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Remove "${resource.title}" from the Resources page?`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/resources/${resource.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (!data.success) throw new Error(data.error ?? "Delete failed.");
      onDeleted(resource.id);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Delete failed.");
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-gray-200 p-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-gray-900 focus:outline-none"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-gray-900 focus:outline-none"
        />
        {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
        <div className="mt-2 flex gap-3">
          <button
            onClick={save}
            disabled={busy}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setTitle(resource.title);
              setDescription(resource.description ?? "");
              setError(null);
            }}
            disabled={busy}
            className="text-xs font-medium text-gray-600 hover:underline"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-900">{resource.title}</p>
        {resource.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{resource.description}</p>
        )}
        <p className="mt-0.5 text-[11px] text-gray-400">
          {resource.filename ?? resource.url}
          {resource.size_bytes ? ` · ${formatSize(resource.size_bytes)}` : ""}
        </p>
        {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <a
          href={resource.url}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-blue-600 hover:underline"
        >
          View
        </a>
        <button
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-gray-600 hover:underline"
        >
          Rename
        </button>
        <button
          onClick={remove}
          disabled={busy}
          className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export function ResourcesSection({
  authHeaders,
  hideHeader = false,
}: {
  authHeaders: Record<string, string>;
  /** The dedicated admin page already renders a title — skip the card's own. */
  hideHeader?: boolean;
}) {
  const [resources, setResources] = useState<Resource[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/admin/resources", { headers: authHeaders });
        const data = (await response.json()) as {
          success: boolean;
          resources?: Resource[];
          error?: string;
        };
        if (cancelled) return;
        if (data.success && data.resources) setResources(data.resources);
        else setError(data.error ?? "Could not load resources.");
      } catch {
        if (!cancelled) setError("Could not load resources.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authHeaders]);

  async function addResource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !file) {
      setError("A title and file are required.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("title", title.trim());
      form.set("description", description.trim());
      form.set("file", file);
      const response = await fetch("/api/admin/resources", {
        method: "POST",
        headers: authHeaders,
        body: form,
      });
      const data = (await response.json()) as { success: boolean; resource?: Resource; error?: string };
      if (!data.success || !data.resource) throw new Error(data.error ?? "Upload failed.");
      setResources((prev) => [data.resource!, ...(prev ?? [])]);
      setTitle("");
      setDescription("");
      setFile(null);
      (event.target as HTMLFormElement).reset();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      {!hideHeader && (
        <>
          <h3 className="text-sm font-semibold text-gray-900">Resources</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Files and links shown on the prospect-facing Resources page. Add as many as you like —
            each gets a name, optional description, and a file.
          </p>
        </>
      )}

      <form onSubmit={addResource} className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Resource name"
          className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs focus:border-gray-900 focus:outline-none"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs focus:border-gray-900 focus:outline-none"
        />
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-50"
        />
        <button
          type="submit"
          disabled={uploading}
          className="rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Add Resource"}
        </button>
      </form>

      {error && <p className="mt-3 text-xs text-red-700">{error}</p>}

      <div className="mt-3 space-y-2">
        {resources === null && !error && <p className="text-xs text-gray-500">Loading…</p>}
        {resources?.length === 0 && (
          <p className="text-xs text-gray-500">No resources yet — add the first one above.</p>
        )}
        {resources?.map((resource) => (
          <ResourceRow
            key={resource.id}
            resource={resource}
            authHeaders={authHeaders}
            onUpdated={(updated) =>
              setResources((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? null)
            }
            onDeleted={(id) => setResources((prev) => prev?.filter((r) => r.id !== id) ?? null)}
          />
        ))}
      </div>
    </div>
  );
}
