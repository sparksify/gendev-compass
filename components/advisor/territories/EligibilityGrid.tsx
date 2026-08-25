"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { US_STATES } from "@/lib/geocoding/states";
import { SIGNAL } from "@/lib/advisor/discoveryStages";
import {
  STATE_ELIGIBILITY_LABELS,
  type BrandStateEligibilityRecord,
  type StateEligibilityStatus,
} from "@/types/territory";

type ChipStatus = StateEligibilityStatus | "unconfigured";

/**
 * Cycle order when a chip is clicked, per the handoff: Available → Manual
 * review → Not available. The store keeps six statuses; each maps onto one
 * of these three tones, and clicking always lands on the canonical status
 * for the next tone.
 */
const CYCLE: StateEligibilityStatus[] = ["approved", "manual_review", "not_registered"];

type ToneKey = "available" | "manual" | "unavailable";

const TONE_OF: Record<StateEligibilityStatus, ToneKey> = {
  approved: "available",
  exempt: "available",
  pending: "manual",
  manual_review: "manual",
  not_registered: "unavailable",
  restricted: "unavailable",
};

interface Tone {
  color: string;
  tint: string;
  border: string;
  label: string;
}

/** Available green · manual-review amber · not-available gray. Unconfigured
 * states default to manual review, so they wear the same amber tone with a
 * softer label. */
function toneKeyFor(status: ChipStatus): ToneKey {
  return status === "unconfigured" ? "manual" : TONE_OF[status];
}

function toneFor(status: ChipStatus): Tone {
  switch (toneKeyFor(status)) {
    case "available":
      return {
        color: SIGNAL.success,
        tint: SIGNAL.successTint,
        border: "#d9e9dd",
        label: "Available",
      };
    case "unavailable":
      return { color: SIGNAL.neutral, tint: "#fafafb", border: "#ececf0", label: "Not available" };
    default:
      return {
        color: SIGNAL.warning,
        tint: SIGNAL.warningTint,
        border: "#f3e2c8",
        label: "Manual review",
      };
  }
}

type RowState = { status: ChipStatus; dirty: boolean };

/**
 * State eligibility as a chip grid (handoff mock 7b): six per row, each an
 * abbreviation plus a status dot. Clicking a chip cycles its status; "Save
 * changes" in the page header persists everything that changed.
 */
export function EligibilityGrid({
  brandId,
  initialRows,
  onDirtyChange,
  saveSignal,
}: {
  brandId: string;
  initialRows: BrandStateEligibilityRecord[];
  /** Reports the unsaved count up to the page header's Save button. */
  onDirtyChange?: (count: number) => void;
  /** Incremented by the header's Save button to trigger a save. */
  saveSignal?: number;
}) {
  const initial = useMemo(() => {
    const byState = new Map(initialRows.map((row) => [row.state_code, row]));
    const seed: Record<string, RowState> = {};
    for (const state of US_STATES) {
      const existing = byState.get(state.code);
      seed[state.code] = { status: existing ? existing.status : "unconfigured", dirty: false };
    }
    return seed;
  }, [initialRows]);

  const [rows, setRows] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const dirtyCodes = Object.entries(rows)
    .filter(([, row]) => row.dirty)
    .map(([code]) => code);

  function cycle(code: string) {
    setRows((prev) => {
      const currentTone = toneKeyFor(prev[code].status);
      const index = CYCLE.findIndex((status) => TONE_OF[status] === currentTone);
      const next = CYCLE[(index + 1) % CYCLE.length];
      const updated = { ...prev, [code]: { status: next, dirty: true } };
      onDirtyChange?.(Object.values(updated).filter((row) => row.dirty).length);
      return updated;
    });
    setMessage(null);
  }

  async function saveAll() {
    if (dirtyCodes.length === 0 || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/advisor/territories/eligibility", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          rows: dirtyCodes.map((code) => ({ stateCode: code, status: rows[code].status })),
        }),
      });
      const data = await response.json();
      if (data.success) {
        setRows((prev) => {
          const next = { ...prev };
          for (const code of dirtyCodes) next[code] = { ...next[code], dirty: false };
          return next;
        });
        onDirtyChange?.(0);
        setMessage(`Saved ${dirtyCodes.length} state${dirtyCodes.length === 1 ? "" : "s"}.`);
      } else {
        setMessage(data.error ?? "Save failed");
      }
    } catch {
      setMessage("Save failed — check your connection");
    } finally {
      setSaving(false);
    }
  }

  // The page header owns the Save button; it bumps saveSignal to fire this.
  const saveRef = useRef(saveAll);
  saveRef.current = saveAll;
  useEffect(() => {
    if (!saveSignal) return;
    void saveRef.current();
  }, [saveSignal]);

  const counts = {
    available: US_STATES.filter((s) => toneKeyFor(rows[s.code].status) === "available").length,
    manual: US_STATES.filter((s) => toneKeyFor(rows[s.code].status) === "manual").length,
    notAvailable: US_STATES.filter((s) => toneKeyFor(rows[s.code].status) === "unavailable").length,
  };

  // Grouped by status, the way the handoff reads: everything available
  // first, then what needs a look, then what is closed off.
  const TONE_ORDER: Record<ToneKey, number> = { available: 0, manual: 1, unavailable: 2 };
  const ordered = [...US_STATES].sort((a, b) => {
    const byTone =
      TONE_ORDER[toneKeyFor(rows[a.code].status)] - TONE_ORDER[toneKeyFor(rows[b.code].status)];
    return byTone !== 0 ? byTone : a.code.localeCompare(b.code);
  });
  const visible = expanded ? ordered : ordered.slice(0, 35);
  const hidden = ordered.length - visible.length;

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-[11.5px] text-muted-foreground">
          <Legend color={SIGNAL.success} label="Available" count={counts.available} />
          <Legend color={SIGNAL.warning} label="Manual review" count={counts.manual} />
          <Legend color={SIGNAL.neutral} label="Not available" count={counts.notAvailable} />
        </div>
        <p className="text-[11px] text-faint-foreground">
          Unconfigured states default to manual review
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {visible.map((state) => {
          const status = rows[state.code].status;
          const tone = toneFor(status);
          return (
            <button
              key={state.code}
              type="button"
              onClick={() => cycle(state.code)}
              title={`${state.name} — ${status === "unconfigured" ? "Unconfigured (manual review)" : STATE_ELIGIBILITY_LABELS[status]}`}
              aria-label={`${state.name}: ${tone.label}. Click to change.`}
              className="flex items-center justify-between rounded-control border px-[11px] py-2 text-xs font-bold transition-opacity hover:opacity-80"
              style={{ borderColor: tone.border, backgroundColor: tone.tint, color: tone.color }}
            >
              {state.code}
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{ backgroundColor: tone.color }}
              />
            </button>
          );
        })}
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex items-center justify-between rounded-control border px-[11px] py-2 text-xs font-bold"
            style={{ borderColor: "#f3e2c8", backgroundColor: SIGNAL.warningTint, color: SIGNAL.warning }}
          >
            +{hidden}
            <span className="text-[10px] font-semibold">more</span>
          </button>
        )}
      </div>

      <p className="mt-3.5 text-[11px] leading-relaxed text-faint-foreground">
        Registration states are marked not available until the franchisor completes state
        registration. Click a state to cycle its status
        {dirtyCodes.length > 0 && (
          <>
            {" "}
            —{" "}
            <strong className="font-bold" style={{ color: SIGNAL.warning }}>
              {dirtyCodes.length} unsaved
            </strong>
          </>
        )}
        .
      </p>
      {(message || saving) && (
        <p className="mt-1.5 text-[11.5px] text-muted-foreground">
          {saving ? "Saving…" : message}
        </p>
      )}
    </div>
  );
}

function Legend({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="size-[7px] rounded-full" style={{ backgroundColor: color }} />
      {label} · {count}
    </span>
  );
}
