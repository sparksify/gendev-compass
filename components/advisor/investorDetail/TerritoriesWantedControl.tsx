"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

/**
 * The header's "Territories wanted" value — advisor-entered from
 * conversations (NOT the questionnaire). Renders as a bordered value that
 * flips to an inline number editor on click; saves on blur/Enter with an
 * optimistic update against the details PATCH endpoint.
 */
export function TerritoriesWantedControl({
  investorId,
  value,
}: {
  investorId: string;
  value: number | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState<number | null>(value);
  const [error, setError] = useState(false);

  function startEditing() {
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  }

  async function save() {
    const raw = inputRef.current?.value.trim() ?? "";
    setEditing(false);
    const next = raw === "" ? null : Number.parseInt(raw, 10);
    if (next !== null && (!Number.isInteger(next) || next < 0 || next > 999)) return;
    if (next === current) return;
    const previous = current;
    setCurrent(next);
    setError(false);
    try {
      const response = await fetch(`/api/advisor/investors/${investorId}/details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ territoriesWanted: next }),
      });
      const data = (await response.json()) as { success: boolean };
      if (!data.success) throw new Error("save failed");
      router.refresh();
    } catch {
      setCurrent(previous);
      setError(true);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={0}
        max={999}
        defaultValue={current ?? ""}
        aria-label="Territories wanted"
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") inputRef.current?.blur();
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-16 rounded-md border border-primary bg-card px-2 py-[3px] text-[16.5px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className="inline-flex items-baseline gap-1.5 rounded-md border border-border bg-card px-2 py-[3px] transition-colors hover:border-[#bfd4ff] hover:bg-[#f8faff]"
    >
      <span className="text-[16.5px] font-bold text-foreground">{current ?? "—"}</span>
      <span className="text-[12.5px] font-medium text-muted-foreground">units</span>
      <Pencil className="size-[11px] self-center text-faint-foreground" />
      {error && <span className="sr-only">Save failed</span>}
    </button>
  );
}
