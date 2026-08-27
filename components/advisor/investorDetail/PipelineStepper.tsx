"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PIPELINE_STAGES,
  stepLabel,
  type PipelineProgress,
} from "@/lib/advisor/pipelineProgress";
import { SIGNAL } from "@/lib/advisor/discoveryStages";
import { STAGE_LABELS, type InvestorStage } from "@/types/advisor";

/**
 * The 12-stage pipeline strip (v3 handoff): quiet green checks for everything
 * cleared, a yellow pill carrying the stage name and "Current · Stage N of 12"
 * for where they are now, and hollow gray dots for what is still ahead.
 *
 * Numbers were dropped from the steps deliberately — the position is already
 * spelled out under the current pill, and numbering every dot made the strip
 * read as a form rather than a progress line.
 *
 * The strip is a read-only indicator; stage changes go through the select
 * layered over the current pill, which is the existing manual stage-change
 * flow, so every move is still audit-trailed by setStageManually.
 */
export function PipelineStepper({
  investorId,
  progress,
}: {
  investorId: string;
  progress: PipelineProgress;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<InvestorStage>(progress.stage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as InvestorStage;
    const previous = stage;
    setStage(next);
    setError(null);
    setSaving(true);
    try {
      const response = await fetch(`/api/advisor/investors/${investorId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: next }),
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
      setSaving(false);
    }
  }

  const stagePicker = (
    <select
      value={stage}
      onChange={onChange}
      disabled={saving}
      aria-label="Pipeline stage"
      className="absolute inset-0 cursor-pointer appearance-none bg-transparent text-transparent outline-none"
    >
      {PIPELINE_STAGES.map((option) => (
        <option key={option} value={option}>
          {STAGE_LABELS[option]}
        </option>
      ))}
      <option value="NOT_A_FIT">{STAGE_LABELS.NOT_A_FIT}</option>
    </select>
  );

  if (stage === "NOT_A_FIT" || progress.offPipeline) {
    return (
      <div className="rounded-card border border-border bg-card px-[18px] py-3.5">
        <span className="relative inline-flex items-center gap-2">
          {stagePicker}
          <span
            className="pointer-events-none text-[13px] font-bold"
            style={{ color: SIGNAL.neutral }}
          >
            Not a Fit · removed from pipeline
          </span>
          <span aria-hidden className="pointer-events-none text-[11px] text-muted-foreground">
            ⌄
          </span>
        </span>
        {error && <p className="mt-2 text-[13px] text-destructive">{error}</p>}
      </div>
    );
  }

  // Optimistic: the strip redraws against the picked stage while the server
  // round-trip is in flight.
  const currentIndex = PIPELINE_STAGES.indexOf(stage);

  return (
    <div>
      <div
        className={cn(
          "flex items-center overflow-x-auto rounded-card border border-border bg-card px-[18px] py-3 transition-opacity",
          saving && "opacity-60",
        )}
        role="group"
        aria-label={`Pipeline: stage ${currentIndex + 1} of ${progress.total}`}
      >
        {PIPELINE_STAGES.map((option, index) => {
          const done = index < currentIndex;
          const current = index === currentIndex;

          return (
            <div key={option} className="flex shrink-0 items-center">
              {index > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "mx-1 mb-3.5 h-[1.5px] w-5 shrink-0 sm:w-9",
                    index <= currentIndex ? "bg-[#bfdcce]" : "bg-border-soft",
                  )}
                />
              )}

              {current ? (
                <span className="relative flex flex-col items-center gap-[5px] px-0.5">
                  {stagePicker}
                  <span className="pointer-events-none inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill bg-accent px-[13px] py-1 text-[11.5px] font-extrabold text-accent-foreground shadow-[0_1px_4px_rgba(122,95,10,.25)]">
                    <span aria-hidden className="size-1.5 rounded-full bg-accent-foreground" />
                    {stepLabel(option)}
                  </span>
                  <span className="pointer-events-none whitespace-nowrap text-[9.5px] font-bold text-accent-strong">
                    Current · Stage {index + 1} of {progress.total}
                  </span>
                </span>
              ) : (
                <span className="flex w-[52px] flex-col items-center gap-[5px]">
                  {done ? (
                    <span className="flex size-[18px] items-center justify-center rounded-full bg-[#dff0e7]">
                      <Check className="size-[9px] text-success" strokeWidth={3.4} />
                    </span>
                  ) : (
                    <span className="size-[18px] rounded-full border-[1.5px] border-[#d5dcd6] bg-card" />
                  )}
                  <span
                    className={cn(
                      "whitespace-nowrap text-[9.5px] font-semibold",
                      done ? "text-muted-foreground" : "text-[#8b968f]",
                    )}
                  >
                    {stepLabel(option)}
                  </span>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-2 text-[13px] text-destructive">{error}</p>}
    </div>
  );
}
