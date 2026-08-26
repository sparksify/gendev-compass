"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PIPELINE_STAGES, type PipelineProgress } from "@/lib/advisor/pipelineProgress";
import { SIGNAL, DISCOVERY_STAGES } from "@/lib/advisor/discoveryStages";
import { STAGE_LABELS, type InvestorStage } from "@/types/advisor";

const BLUE = DISCOVERY_STAGES[1].color;

/**
 * The pipeline row (handoff 5c): the client's current stage, how far along
 * the 12-stage pipeline that is, and how long they have been sitting there.
 *
 * The slider is a read-only indicator — stage changes go through the label's
 * dropdown, which is the existing manual stage-change flow, so every move is
 * still audit-trailed by setStageManually.
 */
export function PipelineStageSlider({
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

  // Optimistic label; the server round-trip refreshes the real numbers.
  const label = STAGE_LABELS[stage] ?? progress.label;
  const changed = stage !== progress.stage;

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
    <span className="relative inline-flex items-center gap-2">
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
      <span
        className="pointer-events-none text-[17.5px] font-extrabold tracking-[-0.02em]"
        style={{ color: progress.offPipeline ? SIGNAL.neutral : BLUE }}
      >
        {label}
      </span>
      <ChevronDown className="pointer-events-none size-[13px] text-muted-foreground" strokeWidth={2} />
    </span>
  );

  return (
    <div>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-6 gap-y-3 rounded-card border border-border px-5 py-3.5 transition-opacity",
          saving && "opacity-60",
        )}
      >
        <span className="shrink-0">
          <span className="block text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Pipeline stage
          </span>
          <span className="mt-1 flex items-center">{stagePicker}</span>
        </span>

        {progress.offPipeline ? (
          <span className="flex-1 text-[13.5px]" style={{ color: SIGNAL.neutral }}>
            Not a Fit · removed from pipeline
          </span>
        ) : (
          <>
            {/* Read-only progress indicator. */}
            <span
              className="relative flex h-4 min-w-[140px] flex-1 items-center"
              role="img"
              aria-label={`${progress.percent}% through the pipeline, stage ${progress.number} of ${progress.total}`}
            >
              <span className="absolute inset-x-0 h-2 rounded-full bg-border-soft" />
              <span
                className="absolute left-0 h-2 rounded-full"
                style={{ width: `${progress.percent}%`, backgroundColor: BLUE }}
              />
              <span
                className="absolute size-4 -translate-x-2 rounded-full border-[2.5px] bg-white shadow-[0_1px_3px_rgba(16,24,40,.18)]"
                style={{ left: `${progress.percent}%`, borderColor: BLUE }}
              />
            </span>

            <span className="shrink-0 text-right">
              <span
                className="tabular block text-[17.5px] font-extrabold tracking-[-0.02em]"
                style={{ color: BLUE }}
              >
                {progress.percent}%
              </span>
              <span className="mt-0.5 block text-[12px] text-muted-foreground">
                Stage {progress.number} of {progress.total}
                {progress.daysInStage !== null && (
                  <>
                    {" · "}
                    {progress.daysInStage} day{progress.daysInStage === 1 ? "" : "s"} in stage
                  </>
                )}
              </span>
            </span>
          </>
        )}
      </div>

      {error && <p className="mt-2 text-[13px] text-destructive">{error}</p>}
      {changed && !error && !saving && (
        <p className="mt-2 text-[13px] text-muted-foreground">Updating…</p>
      )}
    </div>
  );
}
