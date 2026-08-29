"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, GripVertical, Loader2 } from "lucide-react";
import { Panel } from "@/components/advisor/v3";
import { SECONDARY_BUTTON_SM } from "@/components/advisor/controls";
import { VideoWatchedRing } from "@/components/advisor/VideoWatchedBar";
import { BulkSelectCheckbox } from "@/components/advisor/BulkSelect";
import { SIGNAL } from "@/lib/advisor/discoveryStages";
import { formatRelative } from "@/lib/advisor/format";
import { labelForValue } from "@/lib/advisor/questionnaireCatalog";
import { compactMoney } from "@/lib/advisor/money";
import { cn } from "@/lib/utils";
import type { InvestorRow } from "@/lib/advisor/investors";
import type { InvestorStage } from "@/types/advisor";
import { actionBubble, BOARD_COLUMNS, boardColumnFor, type BoardColumnId } from "./shared";

/**
 * The same client list as the List view, regrouped into a drag-and-drop
 * pipeline board. Every column is a real, single-field destination — a
 * client's stage — so every card is draggable and every column accepts a
 * drop; there's no derived/read-only state to protect here the way the
 * Questionnaires board has to for appointments.
 */
export function ClientsBoardView({ rows }: { rows: InvestorRow[] }) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<Record<string, InvestorStage>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<BoardColumnId | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const byColumn = useMemo(() => {
    const map = new Map<BoardColumnId, InvestorRow[]>();
    for (const row of rows) {
      const columnId = boardColumnFor(row.stage, overrides[row.lead.id]);
      const list = map.get(columnId) ?? [];
      list.push(row);
      map.set(columnId, list);
    }
    return map;
  }, [rows, overrides]);

  const rowsById = useMemo(() => new Map(rows.map((row) => [row.lead.id, row])), [rows]);

  async function handleDrop(column: (typeof BOARD_COLUMNS)[number], leadId: string) {
    setDragOverColumn(null);
    setDraggingId(null);
    const row = rowsById.get(leadId);
    if (!row) return;
    const currentColumn = boardColumnFor(row.stage, overrides[leadId]);
    if (currentColumn === column.id) return;

    const nextStage = column.entryStage;
    const previousOverride = overrides[leadId];
    setError(null);
    setOverrides((current) => ({ ...current, [leadId]: nextStage }));
    setPending((current) => ({ ...current, [leadId]: true }));

    try {
      const response = await fetch(`/api/advisor/investors/${leadId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: nextStage }),
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (!data.success) throw new Error(data.error ?? "Could not update stage");
      router.refresh();
    } catch (err) {
      setOverrides((current) => {
        const next = { ...current };
        if (previousOverride) next[leadId] = previousOverride;
        else delete next[leadId];
        return next;
      });
      setError(err instanceof Error ? err.message : "Could not update stage");
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
      <div className="flex gap-3.5 overflow-x-auto pb-2">
        {BOARD_COLUMNS.map((column) => {
          const columnRows = byColumn.get(column.id) ?? [];
          const isDragTarget = dragOverColumn === column.id;

          return (
            <div key={column.id} className="flex w-[270px] shrink-0 flex-col gap-2.5">
              <div className="flex items-center gap-2 px-0.5">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: column.color }}
                />
                <span className="truncate text-[13px] font-extrabold text-foreground">
                  {column.title}
                </span>
                <span className="tabular text-[12px] font-bold text-muted-foreground">
                  {columnRows.length}
                </span>
              </div>

              <div
                data-column={column.id}
                className={cn(
                  "flex min-h-[64px] flex-col gap-2 rounded-card transition-colors",
                  isDragTarget && "bg-primary-soft/60 outline-dashed outline-2 outline-primary/40",
                )}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverColumn(column.id);
                }}
                onDragLeave={() =>
                  setDragOverColumn((current) => (current === column.id ? null : current))
                }
                onDrop={(event) => {
                  event.preventDefault();
                  const leadId = event.dataTransfer.getData("text/plain");
                  if (leadId) void handleDrop(column, leadId);
                }}
              >
                {columnRows.length === 0 && (
                  <Panel className="py-6 text-center text-[12px] text-ghost-foreground">
                    None right now
                  </Panel>
                )}
                {columnRows.map((row) => (
                  <ClientCard
                    key={row.lead.id}
                    row={row}
                    isPending={Boolean(pending[row.lead.id])}
                    isDragging={draggingId === row.lead.id}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", row.lead.id);
                      event.dataTransfer.effectAllowed = "move";
                      setDraggingId(row.lead.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverColumn(null);
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

function ClientCard({
  row,
  isPending,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  row: InvestorRow;
  isPending: boolean;
  isDragging: boolean;
  onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  const name = `${row.lead.first_name} ${row.lead.last_name}`;
  const capital = compactMoney(
    labelForValue(row.questionnaire?.liquid_capital ?? row.lead.initial_liquid_capital),
  );
  const bubble = actionBubble(row);
  const [ghlLoading, setGhlLoading] = useState(false);
  const [ghlError, setGhlError] = useState<string | null>(null);

  async function openInGhl() {
    // Opened synchronously, in direct response to the click, so the popup
    // blocker allows it — the lookup that decides where it points to is
    // async and would otherwise arrive too late to open a tab itself.
    const tab = window.open("", "_blank");
    setGhlLoading(true);
    setGhlError(null);
    try {
      const response = await fetch(`/api/advisor/investors/${row.lead.id}/ghl-url`);
      const data = (await response.json()) as { success: boolean; url: string | null; reason?: string };
      if (data.url) {
        if (tab) tab.location.href = data.url;
        else window.open(data.url, "_blank");
      } else {
        tab?.close();
        setGhlError(data.reason ?? "Could not find this contact in HighLevel.");
      }
    } catch {
      tab?.close();
      setGhlError("Could not reach HighLevel.");
    } finally {
      setGhlLoading(false);
    }
  }

  return (
    <Panel
      data-lead-id={row.lead.id}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "flex flex-col gap-2 px-3.5 py-3 transition-opacity",
        isDragging && "opacity-40",
        isPending && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-start gap-[7px]">
          <GripVertical
            aria-hidden
            className="mt-0.5 size-3.5 shrink-0 cursor-grab text-faint-foreground active:cursor-grabbing"
          />
          <BulkSelectCheckbox id={row.lead.id} />
          <a href={`/advisor/investors/${row.lead.id}`} className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="block truncate text-[13px] font-bold text-foreground hover:underline">
                {name}
              </span>
              {row.followUp.needed && (
                <span
                  aria-label="Follow-up due"
                  title={row.followUp.reasons[0]}
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: SIGNAL.alert }}
                />
              )}
            </span>
            <span className="block truncate text-[11.5px] font-medium text-faint-foreground">
              {row.lead.email}
            </span>
          </a>
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="tabular text-[12.5px] font-bold text-foreground">{capital}</span>
        <VideoWatchedRing
          percent={row.video?.highest_percent_watched ?? null}
          completed={row.video?.completed ?? false}
        />
      </div>

      {row.nextAction !== "—" && (
        <span
          className="inline-flex max-w-full items-center self-start rounded-pill px-[9px] py-[3px] text-[11px] font-bold"
          style={{ color: bubble.color, backgroundColor: bubble.tint }}
        >
          <span className="truncate">{row.nextAction}</span>
        </span>
      )}

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span className="text-[11px] font-medium text-faint-foreground">
          {formatRelative(row.lastActivityAt)}
        </span>
        <button
          type="button"
          onClick={openInGhl}
          disabled={ghlLoading}
          className={cn(SECONDARY_BUTTON_SM, "shrink-0")}
        >
          {ghlLoading ? (
            <Loader2 className="size-[11px] animate-spin" strokeWidth={2} />
          ) : (
            <ExternalLink className="size-[11px]" strokeWidth={2} />
          )}
          HighLevel
        </button>
      </div>
      {ghlError && (
        <p role="alert" className="text-[11px] font-medium text-destructive">
          {ghlError}
        </p>
      )}
    </Panel>
  );
}
