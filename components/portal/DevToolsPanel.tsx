"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Development-only controls (spec §36): simulate video completion and reset
 * progress. The server component only renders this when dev tools are
 * enabled, and the API route independently refuses in production.
 */
export function DevToolsPanel({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(
    action: "simulate-video-completion" | "reset-progress" | "simulate-fdd-received",
  ) {
    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch(`/api/portal/${token}/dev`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json()) as { success: boolean; message?: string };
      setMessage(data.success ? (data.message ?? "Done") : "Failed");
      router.refresh();
    } catch {
      setMessage("Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-card border border-dashed border-amber-400 bg-amber-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
        Development tools — never shown in production
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => run("simulate-video-completion")}
          disabled={busy !== null}
          className="rounded-lg border border-amber-500 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
        >
          {busy === "simulate-video-completion" ? "Simulating…" : "Simulate video completion"}
        </button>
        <button
          type="button"
          onClick={() => run("simulate-fdd-received")}
          disabled={busy !== null}
          className="rounded-lg border border-amber-500 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
        >
          {busy === "simulate-fdd-received" ? "Simulating…" : "Simulate FDD acknowledgment"}
        </button>
        <button
          type="button"
          onClick={() => run("reset-progress")}
          disabled={busy !== null}
          className="rounded-lg border border-amber-500 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
        >
          {busy === "reset-progress" ? "Resetting…" : "Reset progress"}
        </button>
      </div>
      {message && <p className="mt-2 text-sm text-amber-900">{message}</p>}
    </div>
  );
}
