"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FieldError } from "@/components/ui/form-fields";
import { formatRelative } from "@/lib/advisor/format";
import { cn } from "@/lib/utils";
import type { AdvisorNoteRecord } from "@/types/advisor";

const PREVIEW_COUNT = 3;

/**
 * Read-first notes: the ivory list of past entries carries the card, and
 * composing lives behind the "Add note" button rather than a permanent
 * editor taking half the card.
 */
export function AdvisorNotesCard({
  investorId,
  notes,
  staffNameById,
  currentStaffId,
}: {
  investorId: string;
  notes: AdvisorNoteRecord[];
  staffNameById: Record<string, string>;
  currentStaffId: string;
}) {
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const latest = notes[0] ?? null;
  const visible = showAll ? notes : notes.slice(0, PREVIEW_COUNT);

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
    <Card id="advisor-notes" className="h-full scroll-mt-4">
      <CardContent className="px-[15px] py-[13px]">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
            Advisor notes
          </p>
          <div className="flex items-center gap-2.5">
            {latest && (
              <p className="text-[11px] text-faint-foreground">
                Updated {formatRelative(latest.updated_at)}
              </p>
            )}
            <button
              type="button"
              onClick={() => setComposing((v) => !v)}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Add note
            </button>
          </div>
        </div>

        {composing && (
          <form onSubmit={onSubmit} className="mt-2.5 space-y-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about this client — prior conversations, objections, financing, timeline, family considerations…"
              maxLength={10_000}
              aria-label="New note"
              rows={4}
              autoFocus
              className="block w-full rounded-lg border border-[#ece3c8] bg-[#fffdf5] px-3 py-2.5 text-[12.5px] leading-relaxed text-secondary-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <FieldError message={error ?? undefined} />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={submitting || !note.trim()}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Save note"}
              </button>
              <button
                type="button"
                onClick={() => setComposing(false)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {notes.length === 0 && !composing ? (
          <p className="mt-2.5 text-[13px] text-muted-foreground">
            No notes yet — capture prior conversations, objections, financing, and timeline here.
          </p>
        ) : (
          notes.length > 0 && (
            <div className="mt-2.5 overflow-hidden rounded-lg border border-[#ece3c8] bg-[#fffdf5]">
              {visible.map((n, index) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex gap-[11px] px-3 py-[9px]",
                    index !== visible.length - 1 && "border-b border-[#f2ead4]",
                  )}
                >
                  <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="whitespace-pre-wrap text-[12.5px] leading-normal text-secondary-foreground">
                      {n.note}
                    </p>
                    <p className="mt-1 text-[10.5px] text-[#a89a72]">
                      {staffNameById[n.staff_user_id] ??
                        (n.staff_user_id === currentStaffId ? "You" : "Unknown")}{" "}
                      · {formatRelative(n.created_at)}
                      {n.updated_at !== n.created_at ? ` · edited ${formatRelative(n.updated_at)}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {notes.length > PREVIEW_COUNT && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Note history ({notes.length})
            <ChevronDown className={cn("size-3 transition-transform", showAll && "rotate-180")} />
          </button>
        )}
      </CardContent>
    </Card>
  );
}
