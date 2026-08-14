"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bold, Italic, Link as LinkIcon, List, ListOrdered } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/form-fields";
import { formatRelative } from "@/lib/advisor/format";
import type { AdvisorNoteRecord } from "@/types/advisor";

/** Wraps (or prefixes) the current selection in a plain-text textarea with
 * lightweight markdown-style markers — notes are stored and rendered as
 * plain text (whitespace-pre-wrap), so this is a writing aid, not a rich
 * text editor. */
function applyMark(
  el: HTMLTextAreaElement,
  mode: "wrap" | "linePrefix",
  marker: string,
): { value: string; selectionStart: number; selectionEnd: number } {
  const { value, selectionStart, selectionEnd } = el;
  const selected = value.slice(selectionStart, selectionEnd);

  if (mode === "wrap") {
    const next = `${value.slice(0, selectionStart)}${marker}${selected}${marker}${value.slice(selectionEnd)}`;
    return {
      value: next,
      selectionStart: selectionStart + marker.length,
      selectionEnd: selectionStart + marker.length + selected.length,
    };
  }

  // linePrefix: prefix each selected line (or the current line if nothing is
  // selected) with the marker.
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEnd = selectionEnd === selectionStart ? value.indexOf("\n", selectionStart) : selectionEnd;
  const effectiveEnd = lineEnd === -1 ? value.length : lineEnd;
  const block = value.slice(lineStart, effectiveEnd);
  const prefixed = block
    .split("\n")
    .map((line) => `${marker}${line}`)
    .join("\n");
  const next = value.slice(0, lineStart) + prefixed + value.slice(effectiveEnd);
  return {
    value: next,
    selectionStart: lineStart,
    selectionEnd: lineStart + prefixed.length,
  };
}

/**
 * The operationally critical card on the page — prior conversations,
 * objections, financing/timeline context. Deliberately given a large
 * writing surface and equal visual weight to Next Best Action, not treated
 * as a small sidebar utility.
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const latest = notes[0] ?? null;

  function mark(mode: "wrap" | "linePrefix", marker: string) {
    const el = textareaRef.current;
    if (!el) return;
    const result = applyMark(el, mode, marker);
    setNote(result.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  }

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
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    // Notepad treatment: warm ivory paper, not a form field — the one card
    // that should read as "an advisor is writing here" at a glance.
    <Card className="h-full rounded-2xl border-[#e8dfc0] bg-[#fdfaf0]">
      <CardContent className="flex h-full flex-col p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Advisor Notes</p>
          {latest && (
            <p className="text-xs text-muted-foreground">
              Last updated {formatRelative(latest.updated_at)}
              {staffNameById[latest.staff_user_id] &&
                ` · ${staffNameById[latest.staff_user_id]}`}
            </p>
          )}
        </div>

        <form onSubmit={onSubmit} className="mt-3 flex flex-1 flex-col space-y-2">
          <div className="flex items-center gap-1 rounded-t-control border border-b-0 border-[#e8dfc0] bg-[#f7f1de] px-2 py-1.5">
            {[
              { icon: Bold, label: "Bold", onClick: () => mark("wrap", "**") },
              { icon: Italic, label: "Italic", onClick: () => mark("wrap", "_") },
              { icon: List, label: "Bulleted list", onClick: () => mark("linePrefix", "- ") },
              { icon: ListOrdered, label: "Numbered list", onClick: () => mark("linePrefix", "1. ") },
              { icon: LinkIcon, label: "Link", onClick: () => mark("wrap", "") },
            ].map(({ icon: Icon, label, onClick }) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                onClick={onClick}
                className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-white hover:text-foreground"
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note about this client — prior conversations, objections, financing, timeline, family considerations…"
            maxLength={10_000}
            aria-label="New note"
            rows={8}
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, transparent, transparent 27px, rgba(180, 150, 80, 0.16) 27px, rgba(180, 150, 80, 0.16) 28px)",
              backgroundPosition: "0 12px",
              lineHeight: "28px",
            }}
            className="block w-full flex-1 rounded-b-control border border-[#e8dfc0] bg-[#fffdf6] px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <FieldError message={error ?? undefined} />
          <div className="flex items-center justify-between pt-1">
            <Button type="submit" size="sm" disabled={submitting || !note.trim()}>
              {submitting ? "Saving…" : "Save Note"}
            </Button>
            {notes.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="text-xs font-medium text-primary hover:underline"
              >
                {showHistory ? "Hide" : "View"} note history ({notes.length})
              </button>
            )}
          </div>
        </form>

        {showHistory && (
          <ul className="mt-4 space-y-3 border-t border-[#e8dfc0] pt-4">
            {notes.map((n) => (
              <li key={n.id} className="rounded-control border border-[#e8dfc0] bg-[#f7f1de] p-3">
                <p className="whitespace-pre-wrap text-sm text-foreground">{n.note}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {staffNameById[n.staff_user_id] ?? (n.staff_user_id === currentStaffId ? "You" : "Unknown")} ·{" "}
                  {formatRelative(n.created_at)}
                  {n.updated_at !== n.created_at ? ` · edited ${formatRelative(n.updated_at)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
