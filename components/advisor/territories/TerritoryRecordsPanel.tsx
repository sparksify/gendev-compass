"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect, Textarea, FieldError } from "@/components/ui/form-fields";
import { Badge } from "@/components/ui/badge";
import {
  PUBLIC_DISPLAY_LEVELS,
  TERRITORY_DEFINITION_TYPES,
  TERRITORY_STATUSES,
  type TerritoryDefinitionRecord,
  type TerritoryDefinitionType,
  type TerritoryStatus,
} from "@/types/territory";
import { CSV_TEMPLATE_HEADER } from "@/lib/territory/csv";

interface TerritoryRecordsPanelProps {
  brandId: string;
  initialTerritories: TerritoryDefinitionRecord[];
  initialZipCounts: Record<string, number>;
}

const emptyForm = {
  territoryName: "",
  territoryCode: "",
  definitionType: "zip_list" as TerritoryDefinitionType,
  status: "available" as TerritoryStatus,
  centerLatitude: "",
  centerLongitude: "",
  radiusMiles: "",
  publicDisplayLevel: "generalized" as "hidden" | "generalized" | "exact",
  internalNotes: "",
  awardedAt: "",
  reservedUntil: "",
};

export function TerritoryRecordsPanel({ brandId, initialTerritories, initialZipCounts }: TerritoryRecordsPanelProps) {
  const [territories, setTerritories] = useState(initialTerritories);
  const [zipCounts, setZipCounts] = useState(initialZipCounts);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [csvText, setCsvText] = useState("");
  const [csvResult, setCsvResult] = useState<{ summary: Record<string, number>; rowErrors: Array<{ row: number; errors: string[] }> } | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);

  async function createTerritory() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/advisor/territories/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          territoryName: form.territoryName,
          territoryCode: form.territoryCode || undefined,
          definitionType: form.definitionType,
          status: form.status,
          centerLatitude: form.centerLatitude ? Number(form.centerLatitude) : undefined,
          centerLongitude: form.centerLongitude ? Number(form.centerLongitude) : undefined,
          radiusMiles: form.radiusMiles ? Number(form.radiusMiles) : undefined,
          publicDisplayLevel: form.publicDisplayLevel,
          internalNotes: form.internalNotes || undefined,
          awardedAt: form.awardedAt || undefined,
          reservedUntil: form.reservedUntil || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error ?? "Could not create territory");
        return;
      }
      setTerritories((prev) => [data.territory, ...prev]);
      setZipCounts((prev) => ({ ...prev, [data.territory.id]: 0 }));
      setForm(emptyForm);
      setShowCreate(false);
    } catch {
      setError("Could not create territory — check your connection");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: TerritoryStatus) {
    const response = await fetch(`/api/advisor/territories/records/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    if (data.success) {
      setTerritories((prev) => prev.map((t) => (t.id === id ? data.territory : t)));
    }
  }

  async function submitCsv() {
    setCsvBusy(true);
    setCsvResult(null);
    try {
      const response = await fetch("/api/advisor/territories/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await response.json();
      if (data.success) {
        setCsvResult({ summary: data.summary, rowErrors: data.rowErrors });
        // Refresh the list by refetching zip counts / territories is simplest via reload of this brand's data.
        window.location.reload();
      } else {
        setCsvResult({ summary: {}, rowErrors: [{ row: 0, errors: [data.error ?? "Upload failed"] }] });
      }
    } catch {
      setCsvResult({ summary: {}, rowErrors: [{ row: 0, errors: ["Upload failed — check your connection"] }] });
    } finally {
      setCsvBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{territories.length} territor{territories.length === 1 ? "y" : "ies"}</p>
        <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
          <Plus className="size-4" /> New Territory
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="territoryName">Territory name</Label>
              <Input id="territoryName" className="mt-1" value={form.territoryName} onChange={(e) => setForm({ ...form, territoryName: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="territoryCode">Territory code</Label>
              <Input id="territoryCode" className="mt-1" value={form.territoryCode} onChange={(e) => setForm({ ...form, territoryCode: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="definitionType">Definition type</Label>
              <NativeSelect id="definitionType" className="mt-1" value={form.definitionType} onChange={(e) => setForm({ ...form, definitionType: e.target.value as TerritoryDefinitionType })}>
                {TERRITORY_DEFINITION_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <NativeSelect id="status" className="mt-1" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TerritoryStatus })}>
                {TERRITORY_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </NativeSelect>
            </div>
            {form.definitionType === "radius" && (
              <>
                <div>
                  <Label htmlFor="centerLatitude">Center latitude</Label>
                  <Input id="centerLatitude" className="mt-1" value={form.centerLatitude} onChange={(e) => setForm({ ...form, centerLatitude: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="centerLongitude">Center longitude</Label>
                  <Input id="centerLongitude" className="mt-1" value={form.centerLongitude} onChange={(e) => setForm({ ...form, centerLongitude: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="radiusMiles">Radius (miles)</Label>
                  <Input id="radiusMiles" className="mt-1" value={form.radiusMiles} onChange={(e) => setForm({ ...form, radiusMiles: e.target.value })} />
                </div>
              </>
            )}
            <div>
              <Label htmlFor="publicDisplayLevel">Public display level</Label>
              <NativeSelect id="publicDisplayLevel" className="mt-1" value={form.publicDisplayLevel} onChange={(e) => setForm({ ...form, publicDisplayLevel: e.target.value as typeof form.publicDisplayLevel })}>
                {PUBLIC_DISPLAY_LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="awardedAt">Awarded date</Label>
              <Input id="awardedAt" type="date" className="mt-1" value={form.awardedAt} onChange={(e) => setForm({ ...form, awardedAt: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="reservedUntil">Reservation expires</Label>
              <Input id="reservedUntil" type="date" className="mt-1" value={form.reservedUntil} onChange={(e) => setForm({ ...form, reservedUntil: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="internalNotes">Internal notes (never shown to prospects)</Label>
              <Textarea id="internalNotes" className="mt-1" value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} />
            </div>
            {error && <div className="sm:col-span-2"><FieldError message={error} /></div>}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="button" disabled={saving || !form.territoryName} onClick={createTerritory}>
                {saving && <Loader2 className="animate-spin" />} Create Territory
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Display</th>
                <th className="px-4 py-2.5 font-medium">ZIPs / Radius</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {territories.map((t) => (
                <TerritoryRow
                  key={t.id}
                  territory={t}
                  zipCount={zipCounts[t.id] ?? 0}
                  expanded={expandedId === t.id}
                  onToggle={() => setExpandedId((prev) => (prev === t.id ? null : t.id))}
                  onStatusChange={(status) => updateStatus(t.id, status)}
                  onZipCountChange={(count) => setZipCounts((prev) => ({ ...prev, [t.id]: count }))}
                />
              ))}
              {territories.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    No territories yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Upload className="size-4 text-muted-foreground" strokeWidth={1.8} />
            <p className="text-[13.5px] font-bold text-foreground">Bulk ZIP Import (CSV)</p>
          </div>
          <p className="text-[12.5px] text-muted-foreground">
            Columns: <code className="rounded bg-surface px-1 py-0.5 text-[11.5px]">{CSV_TEMPLATE_HEADER}</code>.
            Rows are grouped by territory_code (or territory_name) — existing territories are reused.
          </p>
          <Textarea
            rows={5}
            placeholder={CSV_TEMPLATE_HEADER}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <Button type="button" disabled={csvBusy || !csvText.trim()} onClick={submitCsv}>
            {csvBusy && <Loader2 className="animate-spin" />} Import CSV
          </Button>
          {csvResult && (
            <div className="rounded-control border border-border bg-surface p-3 text-[12.5px]">
              <p className="font-medium text-foreground">
                {csvResult.summary.createdTerritories ?? 0} created, {csvResult.summary.reusedTerritories ?? 0} reused,{" "}
                {csvResult.summary.zipsAdded ?? 0} ZIPs added
                {csvResult.rowErrors.length > 0 && `, ${csvResult.rowErrors.length} row(s) failed`}
              </p>
              {csvResult.rowErrors.length > 0 && (
                <ul className="mt-2 space-y-1 text-destructive">
                  {csvResult.rowErrors.map((e, i) => (
                    <li key={i}>Row {e.row}: {e.errors.join("; ")}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TerritoryRow({
  territory,
  zipCount,
  expanded,
  onToggle,
  onStatusChange,
  onZipCountChange,
}: {
  territory: TerritoryDefinitionRecord;
  zipCount: number;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (status: TerritoryStatus) => void;
  onZipCountChange: (count: number) => void;
}) {
  const [zips, setZips] = useState<Array<{ id: string; zip_code: string }> | null>(null);
  const [newZips, setNewZips] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadZips() {
    if (territory.definition_type !== "zip_list") return;
    const response = await fetch(`/api/advisor/territories/records/${territory.id}/zips`);
    const data = await response.json();
    if (data.success) setZips(data.zips);
  }

  async function handleToggle() {
    onToggle();
    if (!expanded && zips === null) await loadZips();
  }

  async function addZips() {
    const codes = newZips.split(/[\s,]+/).map((z) => z.trim()).filter(Boolean);
    if (codes.length === 0) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/advisor/territories/records/${territory.id}/zips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zipCodes: codes }),
      });
      const data = await response.json();
      if (data.success) {
        setZips((prev) => [...(prev ?? []), ...data.added]);
        onZipCountChange(zipCount + data.added.length);
        setNewZips("");
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeZip(id: string) {
    setZips((prev) => (prev ?? []).filter((z) => z.id !== id));
    onZipCountChange(Math.max(0, zipCount - 1));
    await fetch(`/api/advisor/territories/records/${territory.id}/zips/${id}`, { method: "DELETE" });
  }

  return (
    <>
      <tr className="border-b border-border-soft last:border-0">
        <td className="px-4 py-2.5">
          <p className="font-medium text-foreground">{territory.territory_name}</p>
          {territory.territory_code && <p className="text-[11.5px] text-muted-foreground">{territory.territory_code}</p>}
        </td>
        <td className="px-4 py-2.5 text-muted-foreground">{territory.definition_type}</td>
        <td className="px-4 py-2.5">
          <NativeSelect
            className="!py-1.5 text-xs"
            value={territory.status}
            onChange={(e) => onStatusChange(e.target.value as TerritoryStatus)}
          >
            {TERRITORY_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </NativeSelect>
        </td>
        <td className="px-4 py-2.5">
          <Badge variant="outline">{territory.public_display_level}</Badge>
        </td>
        <td className="px-4 py-2.5 text-muted-foreground">
          {territory.definition_type === "zip_list" ? `${zipCount} ZIPs` : territory.radius_miles ? `${territory.radius_miles} mi` : "—"}
        </td>
        <td className="px-4 py-2.5 text-right">
          {territory.definition_type === "zip_list" && (
            <button type="button" onClick={handleToggle} className="text-muted-foreground hover:text-foreground">
              {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          )}
        </td>
      </tr>
      {expanded && territory.definition_type === "zip_list" && (
        <tr>
          <td colSpan={6} className="bg-surface px-4 py-3">
            <div className="flex flex-wrap gap-1.5">
              {(zips ?? []).map((z) => (
                <span key={z.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs">
                  {z.zip_code}
                  <button type="button" onClick={() => removeZip(z.id)} className="text-muted-foreground hover:text-destructive" aria-label={`Remove ${z.zip_code}`}>
                    ×
                  </button>
                </span>
              ))}
              {(zips ?? []).length === 0 && <span className="text-xs text-muted-foreground">No ZIP codes yet.</span>}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                value={newZips}
                onChange={(e) => setNewZips(e.target.value)}
                placeholder="75201, 75204, 75214…"
                className="max-w-xs"
              />
              <Button type="button" size="sm" disabled={busy || !newZips.trim()} onClick={addZips}>
                Add
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
