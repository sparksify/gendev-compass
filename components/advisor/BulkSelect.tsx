"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { SECONDARY_BUTTON_SM } from "@/components/advisor/controls";

/**
 * Bulk selection for the flat list pages, with no standing delete
 * affordance: the tables look exactly as they do today until "Select" is
 * pressed, then each row grows a checkbox and the bar offers the
 * destructive action behind a confirm. Deletion endpoints are admin-only
 * server-side; pages simply don't render the bar for non-admins.
 */

interface BulkSelectState {
  selecting: boolean;
  selected: ReadonlySet<string>;
  deleting: boolean;
  error: string | null;
  allIds: string[];
  noun: string;
  toggle: (id: string) => void;
  enter: () => void;
  exit: () => void;
  setAll: (ids: string[]) => void;
  deleteSelected: () => void;
}

const BulkSelectContext = createContext<BulkSelectState | null>(null);

export function BulkSelectProvider({
  endpoint,
  noun,
  allIds,
  children,
}: {
  /** POST target; receives { ids }. */
  endpoint: string;
  /** "client" / "questionnaire" — for the confirm and button copy. */
  noun: string;
  /** Every selectable id in the current view (all pages of the filter). */
  allIds: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const enter = useCallback(() => setSelecting(true), []);
  const exit = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
    setError(null);
  }, []);
  const setAll = useCallback((ids: string[]) => setSelected(new Set(ids)), []);

  const deleteSelected = useCallback(() => {
    const ids = [...selected];
    if (ids.length === 0 || deleting) return;
    const confirmed = window.confirm(
      `Delete ${ids.length} ${noun}${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    void fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
      .then(async (response) => {
        const data = (await response.json()) as { success: boolean; error?: string };
        if (!data.success) {
          setError(data.error ?? "Delete failed.");
          return;
        }
        exit();
        router.refresh();
      })
      .catch(() => setError("Could not reach the server."))
      .finally(() => setDeleting(false));
  }, [selected, deleting, noun, endpoint, exit, router]);

  const state = useMemo(
    () => ({
      selecting,
      selected,
      deleting,
      error,
      allIds,
      noun,
      toggle,
      enter,
      exit,
      setAll,
      deleteSelected,
    }),
    [selecting, selected, deleting, error, allIds, noun, toggle, enter, exit, setAll, deleteSelected],
  );

  return <BulkSelectContext.Provider value={state}>{children}</BulkSelectContext.Provider>;
}

/** The Select / N selected / Delete controls; place anywhere in the provider. */
export function BulkSelectBar() {
  const bulk = useContext(BulkSelectContext);
  if (!bulk) return null;

  if (!bulk.selecting) {
    return (
      <button type="button" onClick={bulk.enter} className={SECONDARY_BUTTON_SM}>
        Select
      </button>
    );
  }

  const everything = bulk.selected.size === bulk.allIds.length && bulk.allIds.length > 0;
  return (
    <span className="flex flex-wrap items-center gap-2.5">
      {bulk.error && <span className="text-[13px] text-destructive">{bulk.error}</span>}
      <span className="tabular text-[13px] font-semibold text-muted-foreground">
        {bulk.selected.size} selected
      </span>
      <button
        type="button"
        onClick={() => bulk.setAll(everything ? [] : bulk.allIds)}
        className="text-[13px] font-semibold text-foreground underline"
      >
        {everything ? "Select none" : `Select all ${bulk.allIds.length}`}
      </button>
      <button type="button" onClick={bulk.exit} className={SECONDARY_BUTTON_SM}>
        Cancel
      </button>
      <button
        type="button"
        onClick={bulk.deleteSelected}
        disabled={bulk.selected.size === 0 || bulk.deleting}
        className="inline-flex items-center justify-center gap-1.5 rounded-control bg-[#b42318] px-[13px] py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#912018] disabled:opacity-50"
      >
        {bulk.deleting ? "Deleting…" : `Delete${bulk.selected.size ? ` ${bulk.selected.size}` : ""}`}
      </button>
    </span>
  );
}

/**
 * The per-row checkbox. Renders nothing outside selection mode, so the
 * table's resting look is untouched. Safe inside a row <Link> — the click
 * is intercepted before it navigates.
 */
export function BulkSelectCheckbox({ id }: { id: string }) {
  const bulk = useContext(BulkSelectContext);
  if (!bulk || !bulk.selecting) return null;
  const checked = bulk.selected.has(id);

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? "Deselect row" : "Select row"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        bulk.toggle(id);
      }}
      className={cn(
        "mr-1 flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors",
        checked ? "border-foreground bg-foreground" : "border-border-strong bg-card",
      )}
    >
      {checked && <Check className="size-3 text-white" strokeWidth={3} />}
    </button>
  );
}
