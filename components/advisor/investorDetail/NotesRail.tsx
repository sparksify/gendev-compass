"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SectionRule } from "@/components/advisor/PageHeader";
import { INK_BUTTON_SM } from "@/components/advisor/controls";
import { Textarea, FieldError } from "@/components/ui/form-fields";
import { formatDate } from "@/lib/advisor/format";
import { DISCOVERY_STAGES } from "@/lib/advisor/discoveryStages";
import type { AdvisorNoteRecord } from "@/types/advisor";

const RULE = DISCOVERY_STAGES[2].color;

/**
 * Notes as the handoff draws them: each entry is a paragraph with a 2px
 * violet left rule and an author/date stamp — no card, no avatar. "Add"
 * sits on the section rule and opens the composer in place.
 */
export function NotesRail({
  investorId,
  notes,
  staffNameById,
}: {
  investorId: string;
  notes: AdvisorNoteRecord[];
  staffNameById: Record<string, string>;
}) {
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? notes : notes.slice(0, 3);

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
            placeholder="Add a note about this client…"
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

      {notes.length === 0 ? (
        <p className="text-[13.5px] leading-[1.45] text-muted-foreground">No notes yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((entry) => (
            <p
              key={entry.id}
              className="border-l-2 pl-3 text-[13.5px] leading-relaxed text-secondary-foreground"
              style={{ borderLeftColor: RULE }}
            >
              {entry.note}
              <span className="mt-1 block text-[12px] text-ghost-foreground">
                {staffNameById[entry.staff_user_id] ?? "Staff"} · {formatDate(entry.created_at)}
              </span>
            </p>
          ))}
          {notes.length > 3 && (
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
