"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea, FieldError } from "@/components/ui/form-fields";

export function NoteForm({ investorId }: { investorId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    <form onSubmit={onSubmit} className="space-y-2">
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note about this investor…"
        maxLength={10_000}
        aria-label="New note"
      />
      <FieldError message={error ?? undefined} />
      <Button type="submit" size="sm" disabled={submitting || !note.trim()}>
        {submitting ? "Saving…" : "Add Note"}
      </Button>
    </form>
  );
}
