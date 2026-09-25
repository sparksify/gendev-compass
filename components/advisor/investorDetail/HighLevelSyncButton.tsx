"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { SECONDARY_BUTTON } from "@/components/advisor/controls";

export function HighLevelSyncButton({ investorId }: { investorId: string }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");

  async function sync() {
    setState("working");
    try {
      const response = await fetch(`/api/advisor/investors/${investorId}/compass-sync`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Sync failed");
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <button type="button" className={SECONDARY_BUTTON} onClick={sync} disabled={state === "working"}>
      <RefreshCw className={`size-3.5 ${state === "working" ? "animate-spin" : ""}`} strokeWidth={2} />
      {state === "working" ? "Syncing…" : state === "done" ? "Synced to HighLevel" : state === "error" ? "Retry sync" : "Sync to HighLevel"}
    </button>
  );
}
