"use client";

import { availabilitySignal } from "@/lib/territory/briefing";
import { useCountUp } from "./useCountUp";
import type { TerritoryEvaluationResult } from "@/types/territory";

function toneClasses(percent: number): { bar: string; text: string } {
  if (percent >= 75) return { bar: "bg-success", text: "text-success" };
  if (percent >= 40) return { bar: "bg-[#d97706]", text: "text-[#92400e]" };
  return { bar: "bg-destructive", text: "text-destructive" };
}

/**
 * Visual restatement of the deterministic screening result as a 0–100
 * signal with an animated fill. The basis line always states what the
 * number reflects, so it reads as communication, not a probability model.
 */
export function ConfidenceMeter({ result }: { result: TerritoryEvaluationResult }) {
  const signal = availabilitySignal(result);
  const animated = useCountUp(signal.percent);
  const tone = toneClasses(signal.percent);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-faint-foreground">
          Availability Signal
        </p>
        <p className={`text-[20px] font-bold tabular-nums ${tone.text}`}>{animated}%</p>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface">
        <div
          className={`ti-meter-bar h-full rounded-full ${tone.bar}`}
          style={{ width: `${signal.percent}%` }}
          role="meter"
          aria-valuenow={signal.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={signal.label}
        />
      </div>
      <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">
        <span className="font-medium text-secondary-foreground">{signal.label}.</span> {signal.basis}
      </p>
    </div>
  );
}
