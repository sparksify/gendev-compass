"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/form-fields";
import { Badge } from "@/components/ui/badge";
import { US_STATES } from "@/lib/geocoding/states";
import { STATE_ELIGIBILITY_LABELS, STATE_ELIGIBILITY_STATUSES } from "@/types/territory";
import type { BrandStateEligibilityRecord, StateEligibilityStatus } from "@/types/territory";

interface EligibilityGridProps {
  brandId: string;
  initialRows: BrandStateEligibilityRecord[];
}

type RowState = { status: StateEligibilityStatus | "unconfigured"; updatedAt: string | null; dirty: boolean };

const FILTER_OPTIONS = ["all", ...STATE_ELIGIBILITY_STATUSES, "unconfigured"] as const;

export function EligibilityGrid({ brandId, initialRows }: EligibilityGridProps) {
  const byState = useMemo(() => {
    const map = new Map(initialRows.map((r) => [r.state_code, r]));
    const initial: Record<string, RowState> = {};
    for (const state of US_STATES) {
      const existing = map.get(state.code);
      initial[state.code] = existing
        ? { status: existing.status, updatedAt: existing.updated_at, dirty: false }
        : { status: "unconfigured", updatedAt: null, dirty: false };
    }
    return initial;
  }, [initialRows]);

  const [rows, setRows] = useState(byState);
  const [filter, setFilter] = useState<(typeof FILTER_OPTIONS)[number]>("all");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  function setStatus(code: string, status: StateEligibilityStatus) {
    setRows((prev) => ({ ...prev, [code]: { ...prev[code], status, dirty: true } }));
    setSaveMessage(null);
  }

  const dirtyCodes = Object.entries(rows).filter(([, r]) => r.dirty).map(([code]) => code);
  const visibleStates = filter === "all" ? US_STATES : US_STATES.filter((s) => rows[s.code].status === filter);
  const unconfiguredCount = US_STATES.filter((s) => rows[s.code].status === "unconfigured").length;

  async function saveAll() {
    if (dirtyCodes.length === 0) return;
    setSaving(true);
    setSaveMessage(null);
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
          for (const code of dirtyCodes) next[code] = { ...next[code], dirty: false, updatedAt: new Date().toISOString() };
          return next;
        });
        setSaveMessage(`Saved ${dirtyCodes.length} state${dirtyCodes.length === 1 ? "" : "s"}.`);
      } else {
        setSaveMessage(data.error ?? "Save failed");
      }
    } catch {
      setSaveMessage("Save failed — check your connection");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[12.5px] text-muted-foreground">
            {unconfiguredCount} state{unconfiguredCount === 1 ? "" : "s"} unconfigured (default to Manual Review)
          </p>
        </div>
        <Button type="button" size="sm" disabled={saving || dirtyCodes.length === 0} onClick={saveAll}>
          {saving && <Loader2 className="animate-spin" />}
          Save {dirtyCodes.length > 0 ? `(${dirtyCodes.length})` : ""}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            className={`rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
              filter === option ? "border-primary-soft-border bg-primary-soft text-primary" : "border-border text-muted-foreground hover:bg-surface"
            }`}
          >
            {option === "all" ? "All" : option === "unconfigured" ? "Unconfigured" : STATE_ELIGIBILITY_LABELS[option]}
          </button>
        ))}
      </div>

      {saveMessage && <p className="text-[12.5px] text-muted-foreground">{saveMessage}</p>}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">State</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Last updated</th>
              </tr>
            </thead>
            <tbody>
              {visibleStates.map((state) => {
                const row = rows[state.code];
                return (
                  <tr key={state.code} className="border-b border-border-soft last:border-0">
                    <td className="px-4 py-2 font-medium text-foreground">
                      {state.name} <span className="text-muted-foreground">({state.code})</span>
                    </td>
                    <td className="px-4 py-2">
                      {row.status === "unconfigured" ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Unconfigured</Badge>
                          <NativeSelect
                            className="!py-1.5 text-xs"
                            value=""
                            onChange={(e) => setStatus(state.code, e.target.value as StateEligibilityStatus)}
                          >
                            <option value="" disabled>Set status…</option>
                            {STATE_ELIGIBILITY_STATUSES.map((s) => (
                              <option key={s} value={s}>{STATE_ELIGIBILITY_LABELS[s]}</option>
                            ))}
                          </NativeSelect>
                        </div>
                      ) : (
                        <NativeSelect
                          className="!py-1.5 text-xs"
                          value={row.status}
                          onChange={(e) => setStatus(state.code, e.target.value as StateEligibilityStatus)}
                        >
                          {STATE_ELIGIBILITY_STATUSES.map((s) => (
                            <option key={s} value={s}>{STATE_ELIGIBILITY_LABELS[s]}</option>
                          ))}
                        </NativeSelect>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
