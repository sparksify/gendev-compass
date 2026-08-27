"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, Pin } from "lucide-react";
import { AccentNote, Panel, PanelHeader } from "@/components/advisor/v3";
import { ACCENT_BUTTON_SM } from "@/components/advisor/controls";
import { Textarea, FieldError } from "@/components/ui/form-fields";
import { formatDate } from "@/lib/advisor/format";
import type { AdvisorNoteRecord } from "@/types/advisor";

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
    <Panel id="notes" className="scroll-mt-4">
      <PanelHeader
        title="Notes"
        meta={
          <button
            type="button"
            onClick={() => setComposing((open) => !open)}
            className="text-[12px] font-bold text-primary hover:underline"
          >
            {composing ? "Cancel" : "＋ Add"}
          </button>
        }
      />

      {composing && (
        <form onSubmit={onSubmit} className="mt-2.5 space-y-2">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="First line becomes the title…"
            maxLength={10_000}
            aria-label="New note"
            autoFocus
          />
          <FieldError message={error ?? undefined} />
          <button type="submit" disabled={submitting || !note.trim()} className={ACCENT_BUTTON_SM}>
            {submitting ? "Saving…" : "Save note"}
          </button>
        </form>
      )}

      {!pinned ? (
        <p className="mt-2.5 text-[13px] text-muted-foreground">No notes yet.</p>
      ) : (
        <AccentNote className="mt-2.5 overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-accent-soft-border px-3.5 py-2 text-[11.5px] text-muted-foreground">
            <Pin className="size-[11px] shrink-0 text-accent-strong" strokeWidth={2} />
            <strong className="font-bold text-foreground">Pinned</strong>
            <span>· {byline(pinned, staffNameById[pinned.staff_user_id] ?? "Staff")}</span>
          </div>
          <div className="px-3.5 py-2.5">
            <p className="text-[13px] font-bold text-foreground">{splitNote(pinned.note).title}</p>
            {splitNote(pinned.note).body && (
              <p className="mt-1.5 whitespace-pre-line text-[12.5px] leading-[1.6] text-muted-foreground">
                {splitNote(pinned.note).body}
              </p>
            )}
          </div>
        </AccentNote>
      )}

      {upcoming && (
        <div className="mt-2 flex items-center gap-2.5 rounded-[11px] border border-border-soft px-3.5 py-2.5">
          <button
            type="button"
            onClick={completeActivity}
            disabled={completing || completed}
            aria-label={`Mark ${upcoming.type} complete`}
            className="flex size-[14px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-ghost-foreground transition-colors disabled:opacity-60 data-[done=true]:border-success data-[done=true]:bg-success"
            data-done={completed}
          >
            {completed && <span className="text-[9px] font-bold leading-none text-white">✓</span>}
          </button>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-bold text-foreground">
              {upcoming.type}
            </span>
            <span className="mt-px block truncate text-[11.5px] font-semibold text-faint-foreground">
              {upcoming.meta}
            </span>
          </span>
          <Phone className="size-3.5 shrink-0 text-faint-foreground" strokeWidth={1.8} />
        </div>
      )}

      {rest.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-2.5">
          {showAll &&
            rest.map((entry) => (
              <p
                key={entry.id}
                className="border-l-2 border-accent-soft-border pl-3 text-[12.5px] leading-relaxed text-muted-foreground"
              >
                {entry.note}
                <span className="mt-1 block text-[11.5px] text-ghost-foreground">
                  {staffNameById[entry.staff_user_id] ?? "Staff"} · {formatDate(entry.created_at)}
                </span>
              </p>
            ))}
          <button
            type="button"
            onClick={() => setShowAll((open) => !open)}
            className="self-start text-[12px] font-bold text-primary hover:underline"
          >
            {showAll ? "Show fewer" : `Show all ${notes.length} notes`}
          </button>
        </div>
      )}
    </Panel>
  );
}
