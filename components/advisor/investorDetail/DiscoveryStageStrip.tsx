"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  DISCOVERY_STAGES,
  discoveryStageIdFor,
  SIGNAL,
  type DiscoveryStageId,
} from "@/lib/advisor/discoveryStages";

/**
 * The 5-stage discovery strip: a 4px segmented bar (done solid, current at
 * 55% opacity, future gray) over a column per stage. Clicking a stage sets
 * it — the same manual stage-change endpoint the rest of the app uses, so
 * the audit event is recorded exactly as before.
 */
export function DiscoveryStageStrip({
  investorId,
  currentStage,
  context,
}: {
  investorId: string;
  currentStage: string;
  /** Sub-line under each stage name: a date for what's done, a live read for
   * where they are. Absent for stages the client hasn't reached. */
  context: Partial<Record<DiscoveryStageId, string>>;
}) {
  const router = useRouter();
  const [stage, setStage] = useState(currentStage);
  const [pending, setPending] = useState<DiscoveryStageId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeId = discoveryStageIdFor(stage);

  async function setDiscoveryStage(id: DiscoveryStageId) {
    if (id === activeId) return;
    const target = DISCOVERY_STAGES[id - 1].entryStage;
    const previous = stage;
    setPending(id);
    setError(null);
    setStage(target);
    try {
      const response = await fetch(`/api/advisor/investors/${investorId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: target }),
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (!data.success) {
        setStage(previous);
        setError(data.error ?? "Stage update failed.");
        return;
      }
      router.refresh();
    } catch {
      setStage(previous);
      setError("Could not reach the server.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <div className="flex h-1 gap-[3px] overflow-hidden rounded-full">
        {DISCOVERY_STAGES.map((entry) => {
          const done = activeId !== null && entry.id < activeId;
          const current = entry.id === activeId;
          return (
            <span
              key={entry.id}
              className="flex-1"
              style={{
                backgroundColor: done || current ? entry.color : SIGNAL.track,
                opacity: current ? 0.55 : 1,
              }}
            />
          );
        })}
      </div>

      <div className="mt-3 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {DISCOVERY_STAGES.map((entry) => {
          const done = activeId !== null && entry.id < activeId;
          const current = entry.id === activeId;
          const reached = done || current;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setDiscoveryStage(entry.id)}
              aria-current={current ? "step" : undefined}
              disabled={pending !== null}
              className={cn(
                "rounded-md p-1 text-left transition-colors hover:bg-surface-raised disabled:opacity-60",
                pending === entry.id && "opacity-60",
              )}
            >
              <span
                className="block text-[9px] font-bold leading-4 tracking-[0.1em]"
                style={{ color: reached ? entry.color : "#c6cbd4" }}
              >
                STAGE {entry.id}
                {done ? " · DONE ✓" : current ? " · NOW" : ""}
              </span>
              <span
                className={cn(
                  "mt-[3px] block text-xs",
                  reached ? "font-bold text-foreground" : "font-semibold text-faint-foreground",
                )}
              >
                {entry.name}
              </span>
              {context[entry.id] && (
                <span className="mt-px block text-[10.5px] text-faint-foreground">
                  {context[entry.id]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && <p className="mt-2 text-[11.5px] text-destructive">{error}</p>}
    </div>
  );
}
