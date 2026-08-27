"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { AccentNote, Panel, PanelHeader, PanelMeta, Pill } from "@/components/advisor/v3";
import { ACCENT_BUTTON_SM } from "@/components/advisor/controls";
import {
  MILESTONES,
  TONE_PILL,
  completeCount,
  milestoneStatus,
  type MilestoneDef,
} from "@/lib/advisor/milestones";
import { formatDate, formatDateTime } from "@/lib/advisor/format";
import { FDD_STATUS_LABELS } from "@/lib/fdd/status";
import { cn } from "@/lib/utils";
import type { FddStatus } from "@/types/fdd";
import type { MilestoneKey, ProcessMilestones } from "@/types/lead";

/** milestone · date · status · action — the grid every row shares. */
const COLS = "20px minmax(0,1fr) 118px 96px auto";

export interface FddMilestone {
  status: FddStatus;
  /** Item 23 receipt — the signed acknowledgment coming back. */
  receivedAt: string | null;
  /** When the waiting period clears and signing may occur. */
  eligibleAt: string | null;
  /** Configured waiting period, in days (counsel-approved; default 14). */
  waitingPeriodDays: number;
}

/**
 * The action shown next to each advisor-set milestone, keyed by its current
 * status: a shortcut that advances the step (status changes are also
 * available directly through the pill's select).
 */
function actionFor(def: MilestoneDef, status: string): { label: string; next?: string; href?: string } | null {
  switch (def.key) {
    case "ops_zoom_call":
      if (status === "not_booked") return { label: "Book", next: "booked" };
      if (status === "booked") return { label: "Mark attended", next: "attended" };
      return { label: "Notes", href: "#notes" };
    case "founder_intro_call":
      if (status === "not_booked") return { label: "Book", next: "booked" };
      if (status === "booked") return { label: "Mark Done", next: "completed" };
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

/** A completed step's quiet green check, or the hollow dot of one not reached. */
function StepMark({ done }: { done: boolean }) {
  return done ? (
    <span className="flex size-[17px] items-center justify-center rounded-full bg-[#dff0e7]">
      <Check className="size-[9px] text-success" strokeWidth={3.4} />
    </span>
  ) : (
    <span className="size-[17px] rounded-full border-[1.5px] border-[#d5dcd6] bg-card" />
  );
}

function Stamp({ children }: { children: React.ReactNode }) {
  return <span className="text-[12px] font-semibold text-faint-foreground">{children}</span>;
}

/** "Aug 9 · 4:32 PM" — the compact stamp the milestone rows carry. */
function stampAt(iso: string | null): string {
  if (!iso) return "—";
  try {
    const at = new Date(iso);
    const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(at);
    const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(at);
    return `${day} · ${time}`;
  } catch {
    return formatDate(iso);
  }
}

/**
 * The six steps to close a franchise sale.
 *
 * Two are derived and not editable here — the questionnaire submission and the
 * FDD Item 23 receipt, both of which are recorded elsewhere (the prospect's
 * submission, and the FDD webhook). The remaining four are advisor-set: the
 * status pill is itself a select, and the right-hand control is a one-click
 * shortcut for the most likely next move.
 *
 * The FDD row is deliberately the loudest thing on the card. Item 23 is the
 * franchise rule the whole timeline hangs off: signing may not occur until the
 * waiting period after the receipt has elapsed, so the row carries the rule in
 * words, the receipt timestamp, and the send control together.
 */
export function ProcessMilestonesCard({
  investorId,
  milestones,
  questionnaireSubmittedAt,
  fdd,
}: {
  investorId: string;
  milestones: ProcessMilestones | null;
  questionnaireSubmittedAt: string | null;
  fdd: FddMilestone;
}) {
  const router = useRouter();
  const [state, setState] = useState<ProcessMilestones>(milestones ?? {});
  const [saving, setSaving] = useState<MilestoneKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendingFdd, setSendingFdd] = useState(false);

  async function save(key: MilestoneKey, status: string, date?: string | null) {
    const previous = state;
    const entry = { status, date: date !== undefined ? date : (state[key]?.date ?? null) };
    setState({ ...state, [key]: entry });
    setSaving(key);
    setError(null);
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
      setError("Could not save — try again.");
    } finally {
      setSaving(null);
    }
  }

  async function sendFdd() {
    setSendingFdd(true);
    setError(null);
    try {
      const response = await fetch(`/api/advisor/investors/${investorId}/fdd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (!data.success) {
        setError(data.error ?? "FDD request failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSendingFdd(false);
    }
  }

  const questionnaireDone = Boolean(questionnaireSubmittedAt);
  const item23Signed = Boolean(fdd.receivedAt);
  // Six rows: the two derived ones plus the four advisor-set milestones.
  const done = completeCount(state) + (questionnaireDone ? 1 : 0) + (item23Signed ? 1 : 0);

  return (
    <Panel id="milestones" className="scroll-mt-4">
      <PanelHeader
        title="Process Milestones"
        meta={<PanelMeta>{done} of {MILESTONES.length + 2} complete</PanelMeta>}
      />

      {/* Derived: the prospect submitted the questionnaire. */}
      <div
        className="mt-[5px] grid items-center gap-x-3 border-b border-border-soft py-[9px]"
        style={{ gridTemplateColumns: COLS }}
      >
        <StepMark done={questionnaireDone} />
        <span
          className={cn(
            "text-[13.5px] font-semibold",
            questionnaireDone ? "text-muted-foreground" : "text-foreground",
          )}
        >
          Questionnaire completed
        </span>
        <Stamp>{stampAt(questionnaireSubmittedAt)}</Stamp>
        {questionnaireDone ? (
          <Pill tone="success">Completed</Pill>
        ) : (
          <Pill tone="neutral">Not Submitted</Pill>
        )}
        {questionnaireDone ? (
          <a
            href="#questionnaire-responses"
            className="text-[12.5px] font-bold text-muted-foreground hover:text-foreground"
          >
            View
          </a>
        ) : (
          <span />
        )}
      </div>

      {/* Derived: the FDD send and its Item 23 receipt — the rule the rest of
          the timeline depends on, so it is the row that stands out. */}
      <AccentNote className="my-2 grid items-center gap-x-3 px-3 py-2.5" style={{ gridTemplateColumns: COLS }}>
        {item23Signed ? (
          <StepMark done />
        ) : (
          <span className="flex size-[17px] items-center justify-center rounded-full border-2 border-accent bg-card">
            <span aria-hidden className="size-[5px] rounded-full bg-[#c99e1a]" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block text-[13.5px] font-extrabold text-foreground">
            FDD · Item 23 receipt
          </span>
          <span className="mt-px block text-[11px] font-semibold text-accent-strong">
            Signing can occur no earlier than {fdd.waitingPeriodDays} days after Item 23 is signed
          </span>
        </span>
        <Stamp>Item 23 signed: {fdd.receivedAt ? formatDate(fdd.receivedAt) : "—"}</Stamp>
        <Pill tone={item23Signed ? "success" : fdd.status === "not_requested" ? "neutral" : "warning"}>
          {fdd.status === "not_requested" ? "Not Sent" : FDD_STATUS_LABELS[fdd.status]}
        </Pill>
        {fdd.status === "not_requested" ? (
          <button
            type="button"
            onClick={sendFdd}
            disabled={sendingFdd}
            className={ACCENT_BUTTON_SM}
          >
            {sendingFdd ? "Sending…" : "Send FDD"}
          </button>
        ) : (
          <span />
        )}
      </AccentNote>

      {/* Advisor-set milestones. */}
      {MILESTONES.map((def, index) => {
        const current = milestoneStatus(state, def);
        const date = state[def.key]?.date ?? null;
        const action = actionFor(def, current.value);
        const isLast = index === MILESTONES.length - 1;
        const complete = Boolean(current.complete);
        const active = current.tone === "amber";

        // Signing day can't precede the waiting period; when the receipt is in,
        // say the earliest date outright instead of restating the rule.
        const signingHint =
          def.key === "signing_day"
            ? fdd.eligibleAt
              ? `Earliest ${formatDate(fdd.eligibleAt)} — ${fdd.waitingPeriodDays} days after Item 23`
              : `Auto-suggested ${fdd.waitingPeriodDays} days after Item 23 signature`
            : null;

        return (
          <div
            key={def.key}
            className={cn(
              "grid items-center gap-x-3 py-[9px]",
              !isLast && "border-b border-border-soft",
            )}
            style={{ gridTemplateColumns: COLS }}
          >
            {active && !complete ? (
              <span className="size-[17px] rounded-full border-2 border-accent bg-[#fffbee]" />
            ) : (
              <StepMark done={complete} />
            )}

            <span className="min-w-0">
              <span
                className={cn(
                  "block text-[13.5px]",
                  complete
                    ? "font-semibold text-muted-foreground"
                    : active
                      ? "font-extrabold text-foreground"
                      : "font-semibold text-foreground",
                )}
              >
                {def.label}
              </span>
              {signingHint && (
                <span className="mt-px block text-[11px] font-semibold text-faint-foreground">
                  {signingHint}
                </span>
              )}
            </span>

            {def.hasDate && date ? (
              <span
                className={cn(
                  "text-[12px] font-bold",
                  active ? "text-secondary-foreground" : "font-semibold text-faint-foreground",
                )}
              >
                {formatDate(date)}
              </span>
            ) : def.key === "signing_day" && fdd.eligibleAt ? (
              <Stamp>Earliest: {formatDate(fdd.eligibleAt)}</Stamp>
            ) : def.key === "signing_day" ? (
              <Stamp>Earliest: Item 23 + {fdd.waitingPeriodDays}d</Stamp>
            ) : (
              <Stamp>—</Stamp>
            )}

            {/* Pill = transparent select overlay, so any status is settable directly. */}
            <Pill
              tone={TONE_PILL[current.tone]}
              className={cn("relative pr-5", saving === def.key && "opacity-60")}
            >
              <select
                value={current.value}
                onChange={(event) => save(def.key, event.target.value)}
                disabled={saving === def.key}
                aria-label={`${def.label} status`}
                className="absolute inset-0 cursor-pointer appearance-none bg-transparent text-transparent outline-none"
              >
                {def.statuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none">{current.label}</span>
              <ChevronDown className="pointer-events-none absolute right-1 size-3" />
            </Pill>

            <span className="flex items-center gap-2.5 justify-self-end">
              {action &&
                (action.href ? (
                  <a href={action.href} className="text-[12.5px] font-bold text-primary hover:underline">
                    {action.label}
                  </a>
                ) : active ? (
                  <button
                    type="button"
                    onClick={() => save(def.key, action.next!)}
                    disabled={saving === def.key}
                    className={ACCENT_BUTTON_SM}
                  >
                    {action.label}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => save(def.key, action.next!)}
                    disabled={saving === def.key}
                    className="text-[12.5px] font-bold text-primary hover:underline disabled:opacity-50"
                  >
                    {action.label}
                  </button>
                ))}
              {def.hasDate && current.value !== def.statuses[0].value && (
                <input
                  type="date"
                  value={date ? date.slice(0, 10) : ""}
                  onChange={(event) =>
                    save(
                      def.key,
                      current.value,
                      event.target.value
                        ? new Date(`${event.target.value}T12:00:00Z`).toISOString()
                        : null,
                    )
                  }
                  aria-label={`${def.label} date`}
                  className="w-[26px] cursor-pointer border-0 bg-transparent text-[12px] text-faint-foreground outline-none [&::-webkit-calendar-picker-indicator]:opacity-60"
                />
              )}
            </span>
          </div>
        );
      })}

      {error && <p className="mt-2 text-[12.5px] text-destructive">{error}</p>}
      {fdd.receivedAt && (
        <p className="mt-2 text-[11px] font-semibold text-faint-foreground">
          Item 23 acknowledged {formatDateTime(fdd.receivedAt)}.
        </p>
      )}
    </Panel>
  );
}
