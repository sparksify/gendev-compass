"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, Pin } from "lucide-react";
import { SectionRule } from "@/components/advisor/PageHeader";
import { INK_BUTTON_SM } from "@/components/advisor/controls";
import { Textarea, FieldError } from "@/components/ui/form-fields";
import { formatDate } from "@/lib/advisor/format";
import { SIGNAL } from "@/lib/advisor/discoveryStages";
import type { AdvisorNoteRecord } from "@/types/advisor";

const AMBER_BORDER = "#f3e2c8";

export interface UpcomingActivity {
  id: string;
  /** "Call", "Consultation" — what kind of touch this is. */
  type: string;
  /** "Nov 12 · Darko · David Kim" */
  meta: string;
}

/** Today at 2:10 PM · Darko — the pinned card's byline. */
function byline(note: AdvisorNoteRecord, authorName: string): string {
  const at = new Date(note.created_at);
  const today = new Date().toDateString() === at.toDateString();
  const time = at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${today ? "Today at" : formatDate(note.created_at) + " at"} ${time} · ${authorName}`;
}

/**
 * A note's first line reads as its title in the pinned card, the rest as the
 * body — which is how people already write them ("Client visit checklist"
 * then the steps). Nothing is parsed or reformatted beyond that split.
 */
function splitNote(note: string): { title: string; body: string } {
  const [first, ...rest] = note.split("\n");
  return { title: first.trim(), body: rest.join("\n").trim() };
}

/**
 * Notes as the handoff draws them (5c): the most recent note pinned as an
 * amber card with an author strip, and the next scheduled activity attached
 * beneath it with a checkbox that closes it out.
 *
 * There is no `pinned` flag on AdvisorNoteRecord, so "pinned" is the most
 * recent note — the handoff's sanctioned fallback, and no migration.
 */
export function NotesRail({
  investorId,
  notes,
  staffNameById,
  upcoming,
}: {
  investorId: string;
  notes: AdvisorNoteRecord[];
  staffNameById: Record<string, string>;
  upcoming: UpcomingActivity | null;
}) {
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const pinned = notes[0] ?? null;
  const rest = notes.slice(1);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!note.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/advisor/investors/${investorId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (!data.success) {
        setError(data.error ?? "Note could not be saved.");
        return;
      }
      setNote("");
      setComposing(false);
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function completeActivity() {
    if (!upcoming || completing || completed) return;
    setCompleting(true);
    try {
      const response = await fetch(`/api/advisor/investors/${investorId}/appointment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: upcoming.id, status: "COMPLETED" }),
      });
      const data = (await response.json()) as { success: boolean };
      if (data.success) {
        setCompleted(true);
        router.refresh();
      }
    } catch {
      // Leave the box unchecked; the row stays actionable.
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div id="notes">
      <SectionRule
        label="Notes"
        meta={
          <button
            type="button"
            onClick={() => setComposing((open) => !open)}
            className="text-[13px] font-semibold text-foreground underline"
          >
            {composing ? "Cancel" : "Add"}
          </button>
        }
        className="mb-2"
      />

      {composing && (
        <form onSubmit={onSubmit} className="mb-3 space-y-2">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="First line becomes the title…"
            maxLength={10_000}
            aria-label="New note"
            autoFocus
          />
          <FieldError message={error ?? undefined} />
          <button type="submit" disabled={submitting || !note.trim()} className={INK_BUTTON_SM}>
            {submitting ? "Saving…" : "Save note"}
          </button>
        </form>
      )}

      {!pinned ? (
        <p className="text-[13.5px] text-muted-foreground">No notes yet.</p>
      ) : (
        <div
          className="overflow-hidden rounded-card border"
          style={{ borderColor: AMBER_BORDER, backgroundColor: SIGNAL.warningTint }}
        >
          <div
            className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b px-3.5 py-2.5 text-[12px] text-secondary-foreground"
            style={{ borderColor: AMBER_BORDER }}
          >
            <Pin className="size-[13px] shrink-0" style={{ color: SIGNAL.warning }} strokeWidth={2} />
            <strong className="font-bold text-foreground">Pinned</strong>
            <span>· {byline(pinned, staffNameById[pinned.staff_user_id] ?? "Staff")}</span>
            <button
              type="button"
              onClick={() => setComposing(true)}
              className="ml-auto font-semibold text-foreground underline"
            >
              Add a comment
            </button>
          </div>
          <div className="px-3.5 py-3">
            <p className="text-[14px] font-bold text-foreground">{splitNote(pinned.note).title}</p>
            {splitNote(pinned.note).body && (
              <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-[1.7] text-secondary-foreground">
                {splitNote(pinned.note).body}
              </p>
            )}
          </div>
        </div>
      )}

      {upcoming && (
        <div className="mt-2 flex items-center gap-2.5 rounded-card border border-border px-3.5 py-2.5">
          <button
            type="button"
            onClick={completeActivity}
            disabled={completing || completed}
            aria-label={`Mark ${upcoming.type} complete`}
            className="flex size-[15px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-border-strong transition-colors disabled:opacity-60"
            style={completed ? { backgroundColor: SIGNAL.success, borderColor: SIGNAL.success } : undefined}
          >
            {completed && <span className="text-[9px] font-bold leading-none text-white">✓</span>}
          </button>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-bold text-foreground">{upcoming.type}</span>
            <span className="mt-px block truncate text-[12px] text-muted-foreground">
              {upcoming.meta}
            </span>
          </span>
          <Phone className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
        </div>
      )}

      {rest.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {(showAll ? rest : rest.slice(0, 2)).map((entry) => (
            <p
              key={entry.id}
              className="border-l-2 pl-3 text-[13.5px] leading-relaxed text-secondary-foreground"
              style={{ borderLeftColor: AMBER_BORDER }}
            >
              {entry.note}
              <span className="mt-1 block text-[12px] text-ghost-foreground">
                {staffNameById[entry.staff_user_id] ?? "Staff"} · {formatDate(entry.created_at)}
              </span>
            </p>
          ))}
          {rest.length > 2 && (
            <button
              type="button"
              onClick={() => setShowAll((open) => !open)}
              className="self-start text-[13px] font-semibold text-foreground underline"
            >
              {showAll ? "Show fewer" : `Show all ${notes.length} notes`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
