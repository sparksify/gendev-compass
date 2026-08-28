"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarCheck, CalendarClock, ClipboardCheck, Download, GripVertical } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Panel } from "@/components/advisor/v3";
import { SECONDARY_BUTTON_SM } from "@/components/advisor/controls";
import { BulkSelectCheckbox } from "@/components/advisor/BulkSelect";
import { SIGNAL } from "@/lib/advisor/discoveryStages";
import { formatRelative } from "@/lib/advisor/format";
import { labelForValue } from "@/lib/advisor/questionnaireCatalog";
import { cn } from "@/lib/utils";
import type { InvestorRow } from "@/lib/advisor/investors";
import type { QualificationResultValue } from "@/types/lead";
import {
  DRAGGABLE_STAGES,
  qualificationResultForStage,
  submittedAtFor,
  type TriageStage,
  triageStageFor,
} from "./shared";

interface Column {
  stage: TriageStage;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  tint: string;
}

const COLUMNS: Column[] = [
  {
    stage: "needs_review",
    title: "Needs Review",
    description: "Didn't clear automatic qualification",
    icon: AlertCircle,
    color: SIGNAL.warning,
    tint: SIGNAL.warningTint,
  },
  {
    stage: "ready_to_schedule",
    title: "Ready to Schedule",
    description: "Qualified, no consultation booked yet",
    icon: ClipboardCheck,
    color: SIGNAL.neutral,
    tint: SIGNAL.neutralTint,
  },
  {
    stage: "scheduled",
    title: "Consultation Scheduled",
    description: "On the calendar",
    icon: CalendarClock,
    color: SIGNAL.accentInk,
    tint: "#fff6d9",
  },
  {
    stage: "completed",
    title: "Consultation Completed",
    description: "Already talked to the investor",
    icon: CalendarCheck,
    color: SIGNAL.success,
    tint: SIGNAL.successTint,
  },
];

/**
 * The same completed-questionnaire queue as the List view, regrouped into a
 * triage board. Cards can be dragged between "Needs Review" and "Ready to
 * Schedule" — that's a genuine, single-field call (the qualification
 * verdict), so a drag there really does update the investor's record.
 * "Scheduled" and "Completed" reflect a real appointment on the calendar,
 * which a drag can't fabricate, so those two columns are drop targets for
 * neither — cards in them aren't draggable, and dropping onto them is a
 * no-op.
 */
export function QuestionnaireBoardView({ rows }: { rows: InvestorRow[] }) {
  const router = useRouter();
  // Optimistic, drag-driven qualification calls that haven't round-tripped
  // to the server yet (or that failed and were reverted).
  const [overrides, setOverrides] = useState<Record<string, QualificationResultValue>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<TriageStage | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const byStage = useMemo(() => {
    const map = new Map<TriageStage, InvestorRow[]>();
    for (const row of rows) {
      const stage = triageStageFor(row, overrides[row.lead.id]);
      const list = map.get(stage) ?? [];
      list.push(row);
      map.set(stage, list);
    }
    return map;
  }, [rows, overrides]);

  const rowsById = useMemo(() => new Map(rows.map((row) => [row.lead.id, row])), [rows]);

  async function handleDrop(target: "needs_review" | "ready_to_schedule", leadId: string) {
    setDragOverStage(null);
    setDraggingId(null);
    const row = rowsById.get(leadId);
    if (!row) return;
    const currentStage = triageStageFor(row, overrides[leadId]);
    if (currentStage === target) return;
    // Only a card already in the other qualification column can land here —
    // a Scheduled/Completed card was never made draggable in the first place.
    if (!DRAGGABLE_STAGES.has(currentStage)) return;

    const nextResult = qualificationResultForStage(target);
    const previousOverride = overrides[leadId];
    setError(null);
    setOverrides((current) => ({ ...current, [leadId]: nextResult }));
    setPending((current) => ({ ...current, [leadId]: true }));

    try {
      const response = await fetch(`/api/advisor/investors/${leadId}/qualification`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: nextResult }),
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (!data.success) throw new Error(data.error ?? "Could not update qualification");
      router.refresh();
    } catch (err) {
      setOverrides((current) => {
        const next = { ...current };
        if (previousOverride) next[leadId] = previousOverride;
        else delete next[leadId];
        return next;
      });
      setError(err instanceof Error ? err.message : "Could not update qualification");
    } finally {
      setPending((current) => {
        const next = { ...current };
        delete next[leadId];
        return next;
      });
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {error && (
        <p role="alert" className="text-[12.5px] font-semibold text-destructive">
          {error}
        </p>
      )}
      <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((column) => {
          const columnRows = byStage.get(column.stage) ?? [];
          const Icon = column.icon;
          const droppable = DRAGGABLE_STAGES.has(column.stage);
          const isDragTarget = droppable && dragOverStage === column.stage;

          return (
            <div key={column.stage} className="flex min-w-0 flex-col gap-2.5">
              <div className="flex items-center gap-2 px-0.5">
                <span
                  aria-hidden
                  className="flex size-6 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: column.tint, color: column.color }}
                >
                  <Icon className="size-3.5" strokeWidth={2} />
                </span>
                <span className="min-w-0">
                  <span className="flex items-baseline gap-1.5">
                    <span className="truncate text-[13px] font-extrabold text-foreground">
                      {column.title}
                    </span>
                    <span className="tabular text-[12px] font-bold text-muted-foreground">
                      {columnRows.length}
                    </span>
                  </span>
                  <span className="block truncate text-[11px] font-medium text-faint-foreground">
                    {column.description}
                  </span>
                </span>
              </div>

              <div
                data-stage={column.stage}
                className={cn(
                  "flex min-h-[64px] flex-col gap-2 rounded-card transition-colors",
                  isDragTarget && "bg-primary-soft/60 outline-dashed outline-2 outline-primary/40",
                )}
                onDragOver={
                  droppable
                    ? (event) => {
                        event.preventDefault();
                        setDragOverStage(column.stage);
                      }
                    : undefined
                }
                onDragLeave={
                  droppable
                    ? () => setDragOverStage((current) => (current === column.stage ? null : current))
                    : undefined
                }
                onDrop={
                  droppable
                    ? (event) => {
                        event.preventDefault();
                        const leadId = event.dataTransfer.getData("text/plain");
                        if (leadId) void handleDrop(column.stage as "needs_review" | "ready_to_schedule", leadId);
                      }
                    : undefined
                }
              >
                {columnRows.length === 0 && (
                  <Panel className="py-6 text-center text-[12px] text-ghost-foreground">
                    None right now
                  </Panel>
                )}
                {columnRows.map((row) => (
                  <QuestionnaireCard
                    key={row.lead.id}
                    row={row}
                    draggable={droppable}
                    manuallySet={Boolean(overrides[row.lead.id])}
                    isPending={Boolean(pending[row.lead.id])}
                    isDragging={draggingId === row.lead.id}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", row.lead.id);
                      event.dataTransfer.effectAllowed = "move";
                      setDraggingId(row.lead.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverStage(null);
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuestionnaireCard({
  row,
  draggable,
  manuallySet,
  isPending,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  row: InvestorRow;
  draggable: boolean;
  manuallySet: boolean;
  isPending: boolean;
  isDragging: boolean;
  onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  const submittedAt = submittedAtFor(row);
  const name = `${row.lead.first_name} ${row.lead.last_name}`;

  return (
    <Panel
      data-lead-id={row.lead.id}
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      className={cn(
        "flex flex-col gap-2 px-3.5 py-3 transition-opacity",
        isDragging && "opacity-40",
        isPending && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-start gap-[7px]">
          {draggable && (
            <GripVertical
              aria-hidden
              className="mt-0.5 size-3.5 shrink-0 cursor-grab text-faint-foreground active:cursor-grabbing"
            />
          )}
          <BulkSelectCheckbox id={row.lead.id} />
          <a
            href={`/advisor/investors/${row.lead.id}#questionnaire-responses`}
            className="min-w-0"
          >
            <span className="block truncate text-[13px] font-bold text-foreground hover:underline">
              {name}
            </span>
            <span className="block truncate text-[11.5px] font-medium text-faint-foreground">
              {row.lead.email}
            </span>
          </a>
        </span>
        {typeof row.lead.qualification_score === "number" && !manuallySet && (
          <span className="tabular shrink-0 text-[11px] font-bold text-muted-foreground">
            {row.lead.qualification_score}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
        <span className="font-semibold">
          {labelForValue(row.questionnaire?.liquid_capital)}
        </span>
        <span className="truncate">
          {labelForValue(row.questionnaire?.investment_timeline)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span
          className={cn(
            "truncate text-[11px] font-medium",
            submittedAt ? "text-faint-foreground" : "text-ghost-foreground",
          )}
        >
          {manuallySet
            ? "Manually set"
            : submittedAt
              ? `Submitted ${formatRelative(submittedAt)}`
              : "Not submitted"}
        </span>
        <a
          href={`/api/advisor/investors/${row.lead.id}/questionnaire-pdf`}
          download
          className={cn(SECONDARY_BUTTON_SM, "shrink-0")}
          aria-label={`Download ${name}'s questionnaire PDF`}
        >
          <Download className="size-[10px]" strokeWidth={2} />
        </a>
      </div>
    </Panel>
  );
}
