"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Package, PencilLine, Users, Video } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  MILESTONES,
  TONE_PILL,
  completeCount,
  milestoneStatus,
  type MilestoneDef,
} from "@/lib/advisor/milestones";
import { formatDate } from "@/lib/advisor/format";
import { cn } from "@/lib/utils";
import type { MilestoneKey, ProcessMilestones } from "@/types/lead";

const MILESTONE_ICONS: Record<MilestoneKey, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  ops_zoom_call: Video,
  founder_intro_call: Users,
  territory_designed: Package,
  signing_day: PencilLine,
};

/** The action shown next to each milestone, keyed by its current status:
 * a shortcut that advances the step (status changes are also available
 * directly through the pill's select). */
function actionFor(def: MilestoneDef, status: string): { label: string; next?: string; href?: string } | null {
  switch (def.key) {
    case "ops_zoom_call":
      if (status === "not_booked") return { label: "Book", next: "booked" };
      if (status === "booked") return { label: "Mark attended", next: "attended" };
      return { label: "Notes", href: "#advisor-notes" };
    case "founder_intro_call":
      if (status === "not_booked") return { label: "Book", next: "booked" };
      if (status === "booked") return { label: "Mark done", next: "completed" };
      return null;
    case "territory_designed":
      if (status === "not_started") return { label: "Start", next: "in_progress" };
      if (status === "in_progress") return { label: "Review", href: "/advisor/territories" };
      return null;
    case "signing_day":
      if (status === "not_set") return { label: "Set date", next: "scheduled" };
      if (status === "scheduled") return { label: "Mark signed", next: "signed" };
      return null;
  }
}

/**
 * The four sequential steps to close a franchise sale. The status pill is
 * itself a select (same pattern as StageStatusControl); the right-hand link
 * is a one-click shortcut for the most likely next move.
 */
export function ProcessMilestonesCard({
  investorId,
  milestones,
}: {
  investorId: string;
  milestones: ProcessMilestones | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<ProcessMilestones>(milestones ?? {});
  const [saving, setSaving] = useState<MilestoneKey | null>(null);
  const [error, setError] = useState(false);

  async function save(key: MilestoneKey, status: string, date?: string | null) {
    const previous = state;
    const entry = { status, date: date !== undefined ? date : (state[key]?.date ?? null) };
    setState({ ...state, [key]: entry });
    setSaving(key);
    setError(false);
    try {
      const response = await fetch(`/api/advisor/investors/${investorId}/details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestones: { [key]: entry } }),
      });
      const data = (await response.json()) as { success: boolean };
      if (!data.success) throw new Error("save failed");
      router.refresh();
    } catch {
      setState(previous);
      setError(true);
    } finally {
      setSaving(null);
    }
  }

  const done = completeCount(state);

  return (
    <Card className="h-full">
      <CardContent className="px-[15px] py-[13px]">
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-bold text-foreground">
            Process milestones
          </p>
          <p className="text-[11px] text-faint-foreground">{done} of 4 complete</p>
        </div>

        <div className="mt-1.5">
          {MILESTONES.map((def, index) => {
            const Icon = MILESTONE_ICONS[def.key];
            const current = milestoneStatus(state, def);
            const date = state[def.key]?.date ?? null;
            const action = actionFor(def, current.value);
            const isLast = index === MILESTONES.length - 1;

            return (
              <div
                key={def.key}
                className={cn(
                  "grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-x-2.5 py-[7px]",
                  !isLast && "border-b border-border-soft",
                  isLast && "pb-px",
                )}
              >
                <Icon className="size-[15px] text-primary" strokeWidth={1.9} />
                <div className="min-w-0">
                  <span className="whitespace-nowrap text-[13px] font-medium text-foreground">{def.label}</span>
                  {def.hasDate && date && (
                    <span className="ml-1.5 text-[11px] text-faint-foreground">{formatDate(date)}</span>
                  )}
                </div>
                <div className="flex items-center gap-[9px] justify-self-end">
                  {/* Pill = transparent select overlay, so any status is settable directly. */}
                  <span
                    className={cn(
                      "relative inline-flex items-center whitespace-nowrap rounded-full py-0.5 pl-2 pr-5 text-[11px] font-medium transition-opacity",
                      TONE_PILL[current.tone],
                      saving === def.key && "opacity-60",
                    )}
                  >
                    <select
                      value={current.value}
                      onChange={(e) => save(def.key, e.target.value)}
                      disabled={saving === def.key}
                      aria-label={`${def.label} status`}
                      className="absolute inset-0 cursor-pointer appearance-none bg-transparent text-transparent outline-none"
                    >
                      {def.statuses.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none">{current.label}</span>
                    <ChevronDown className="pointer-events-none absolute right-1 size-3" />
                  </span>
                  {action &&
                    (action.href ? (
                      <a href={action.href} className="text-[12.5px] font-semibold text-primary hover:underline">
                        {action.label}
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => save(def.key, action.next!)}
                        disabled={saving === def.key}
                        className="text-[12.5px] font-semibold text-primary hover:underline disabled:opacity-50"
                      >
                        {action.label}
                      </button>
                    ))}
                  {def.hasDate && current.value !== def.statuses[0].value && (
                    <input
                      type="date"
                      value={date ? date.slice(0, 10) : ""}
                      onChange={(e) =>
                        save(
                          def.key,
                          current.value,
                          e.target.value ? new Date(`${e.target.value}T12:00:00Z`).toISOString() : null,
                        )
                      }
                      aria-label={`${def.label} date`}
                      className="w-[30px] cursor-pointer border-0 bg-transparent text-[11px] text-faint-foreground outline-none [&::-webkit-calendar-picker-indicator]:opacity-60"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {error && <p className="mt-1 text-[11px] text-destructive">Could not save — try again.</p>}
      </CardContent>
    </Card>
  );
}
