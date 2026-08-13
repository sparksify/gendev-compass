"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { INVESTOR_STAGES, STAGE_LABELS, type InvestorStage } from "@/types/advisor";
import { STAGE_STYLES } from "@/components/advisor/StageBadge";

/**
 * The stage shown as a colored status pill that IS the editing control — a
 * transparent native <select> layered over a visible label, so it reads as
 * information first and a dropdown second. Same PATCH endpoint as the old
 * StageSelect form field, just no longer boxed like a form.
 */
export function StageStatusControl({
  investorId,
  currentStage,
}: {
  investorId: string;
  currentStage: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState(currentStage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
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

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <div
        className={cn(
          "relative inline-flex items-center whitespace-nowrap rounded-full py-0.5 pl-2.5 pr-6 text-xs font-medium transition-opacity",
          STAGE_STYLES[stage as InvestorStage] ?? "bg-surface text-muted-foreground",
          saving && "opacity-60",
        )}
      >
        <select
          value={stage}
          onChange={onChange}
          disabled={saving}
          aria-label="Investor stage"
          className="absolute inset-0 cursor-pointer appearance-none bg-transparent text-transparent outline-none"
        >
          {INVESTOR_STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        <span className="pointer-events-none">{STAGE_LABELS[stage as InvestorStage] ?? stage}</span>
        <ChevronDown className="pointer-events-none absolute right-1.5 size-3" />
      </div>
      {error && (
        <p role="alert" className="text-[11px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
