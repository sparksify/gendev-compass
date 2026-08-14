"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, FileUp, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect, Textarea, FieldError } from "@/components/ui/form-fields";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PUBLIC_DISPLAY_LEVELS,
  TERRITORY_DEFINITION_TYPES,
  TERRITORY_STATUSES,
  type PublicDisplayLevel,
  type TerritoryDefinitionRecord,
  type TerritoryDefinitionType,
  type TerritoryStatus,
} from "@/types/territory";
import { CSV_TEMPLATE_HEADER } from "@/lib/territory/csv";

/** Statuses offered by the report-upload flow, reordered so the two the
 *  team actually uses day to day — reserving a territory or marking it
 *  pending sale — lead the list; everything else from the existing
 *  framework is still available underneath. */
const REPORT_STATUS_ORDER: TerritoryStatus[] = [
  "reserved",
  "pending",
  "sold",
  "corporate",
  "unavailable",
  "available",
  "archived",
];

const STATUS_LABELS: Record<TerritoryStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  sold: "Sold",
  corporate: "Corporate-owned",
  unavailable: "Unavailable",
  pending: "Pending Sale",
  archived: "Archived",
};

/** Same soft-color palette StageBadge uses elsewhere in the admin app —
 *  reused here rather than inventing a second color language. Applied to
 *  the status <select> itself (colored, not just a static badge) since
 *  status has to stay editable in place. */
const STATUS_STYLES: Record<TerritoryStatus, string> = {
  available: "border-success/30 bg-success-soft text-success",
  reserved: "border-[#f2cf8a] bg-[#fef3c7] text-[#92400e]",
  pending: "border-[#c9bcf5] bg-[#ede9fe] text-[#5b21b6]",
  sold: "border-primary-soft-border bg-primary-soft text-primary",
  corporate: "border-[#c9bcf5] bg-[#ede9fe] text-[#5b21b6]",
  unavailable: "border-[#f5b8b8] bg-[#fee2e2] text-destructive",
  archived: "border-border bg-surface text-muted-foreground",
};

const DISPLAY_LEVEL_LABELS: Record<PublicDisplayLevel, string> = {
  hidden: "Hidden",
  generalized: "Generalized",
  exact: "Exact",
};

const DISPLAY_LEVEL_STYLES: Record<PublicDisplayLevel, string> = {
  hidden: "bg-surface text-muted-foreground",
  generalized: "bg-primary-soft text-primary",
  exact: "bg-success-soft text-success",
};

interface ReportZipPreview {
  zipCode: string;
  city: string | null;
  stateCode: string | null;
  conflict: { territoryId: string; territoryName: string; status: TerritoryStatus } | null;
}

interface ReportPreview {
  territoryName: string;
  territoryCode: string;
  status: TerritoryStatus;
  publicDisplayLevel: PublicDisplayLevel;
  internalNotes: string;
  zips: ReportZipPreview[];
  excludedZips: Set<string>;
  warnings: string[];
}

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
  publicDisplayLevel: "generalized" as PublicDisplayLevel,
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

  function handleReportSaved(territory: TerritoryDefinitionRecord, zipsAdded: number) {
    setTerritories((prev) => {
      const exists = prev.some((t) => t.id === territory.id);
      return exists ? prev.map((t) => (t.id === territory.id ? territory : t)) : [territory, ...prev];
    });
    setZipCounts((prev) => ({ ...prev, [territory.id]: (prev[territory.id] ?? 0) + zipsAdded }));
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

  async function deleteTerritory(id: string): Promise<boolean> {
    const response = await fetch(`/api/advisor/territories/records/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (data.success) {
      setTerritories((prev) => prev.filter((t) => t.id !== id));
      setZipCounts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    return Boolean(data.success);
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
    <div className="space-y-5">
      <UploadReportCard brandId={brandId} onSaved={handleReportSaved} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{territories.length} territor{territories.length === 1 ? "y" : "ies"}</p>
        <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
          <Plus className="size-4" /> New Territory
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="grid grid-cols-1 gap-3.5 p-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="territoryName">Territory name</Label>
              <Input id="territoryName" className="mt-1.5" value={form.territoryName} onChange={(e) => setForm({ ...form, territoryName: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="territoryCode">Territory code</Label>
              <Input id="territoryCode" className="mt-1.5" value={form.territoryCode} onChange={(e) => setForm({ ...form, territoryCode: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="definitionType">Definition type</Label>
              <NativeSelect id="definitionType" className="mt-1.5" value={form.definitionType} onChange={(e) => setForm({ ...form, definitionType: e.target.value as TerritoryDefinitionType })}>
                {TERRITORY_DEFINITION_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <NativeSelect id="status" className="mt-1.5" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TerritoryStatus })}>
                {TERRITORY_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </NativeSelect>
            </div>
            {form.definitionType === "radius" && (
              <>
                <div>
                  <Label htmlFor="centerLatitude">Center latitude</Label>
                  <Input id="centerLatitude" className="mt-1.5" value={form.centerLatitude} onChange={(e) => setForm({ ...form, centerLatitude: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="centerLongitude">Center longitude</Label>
                  <Input id="centerLongitude" className="mt-1.5" value={form.centerLongitude} onChange={(e) => setForm({ ...form, centerLongitude: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="radiusMiles">Radius (miles)</Label>
                  <Input id="radiusMiles" className="mt-1.5" value={form.radiusMiles} onChange={(e) => setForm({ ...form, radiusMiles: e.target.value })} />
                </div>
              </>
            )}
            <div>
              <Label htmlFor="publicDisplayLevel">Public display level</Label>
              <NativeSelect id="publicDisplayLevel" className="mt-1.5" value={form.publicDisplayLevel} onChange={(e) => setForm({ ...form, publicDisplayLevel: e.target.value as PublicDisplayLevel })}>
                {PUBLIC_DISPLAY_LEVELS.map((l) => (
                  <option key={l} value={l}>{DISPLAY_LEVEL_LABELS[l]}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="awardedAt">Awarded date</Label>
              <Input id="awardedAt" type="date" className="mt-1.5" value={form.awardedAt} onChange={(e) => setForm({ ...form, awardedAt: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="reservedUntil">Reservation expires</Label>
              <Input id="reservedUntil" type="date" className="mt-1.5" value={form.reservedUntil} onChange={(e) => setForm({ ...form, reservedUntil: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="internalNotes">Internal notes (never shown to prospects)</Label>
              <Textarea id="internalNotes" className="mt-1.5" value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} />
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
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-faint-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Display</th>
                <th className="px-4 py-3 font-medium">ZIPs / Radius</th>
                <th className="px-4 py-3 font-medium" />
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
                  onDelete={() => deleteTerritory(t.id)}
                />
              ))}
              {territories.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No territories yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3.5 p-5">
          <div className="flex items-center gap-2">
            <Upload className="size-4 text-muted-foreground" strokeWidth={1.8} />
            <p className="text-sm font-semibold text-foreground">Bulk ZIP Import (CSV)</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Columns: <code className="rounded bg-surface px-1 py-0.5 text-xs">{CSV_TEMPLATE_HEADER}</code>.
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
            <div className="rounded-control border-2 border-border-strong bg-surface p-3.5 text-sm">
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
  onDelete,
}: {
  territory: TerritoryDefinitionRecord;
  zipCount: number;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (status: TerritoryStatus) => void;
  onZipCountChange: (count: number) => void;
  onDelete: () => Promise<boolean>;
}) {
  const [zips, setZips] = useState<Array<{ id: string; zip_code: string }> | null>(null);
  const [newZips, setNewZips] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const zipLabel = territory.definition_type === "zip_list" ? ` and its ${zipCount} ZIP code${zipCount === 1 ? "" : "s"}` : "";
    const confirmed = window.confirm(
      `Delete "${territory.territory_name}"${zipLabel}? This cannot be undone.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    const ok = await onDelete();
    if (!ok) {
      setDeleting(false);
      window.alert("Could not delete this territory — please try again.");
    }
    // On success the row unmounts (parent removes it from the list), so
    // there's nothing to reset here.
  }

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
        <td className="px-4 py-3">
          <p className="font-semibold text-foreground">{territory.territory_name}</p>
          {territory.territory_code && <p className="text-xs text-muted-foreground">{territory.territory_code}</p>}
        </td>
        <td className="px-4 py-3 text-secondary-foreground">{territory.definition_type}</td>
        <td className="px-4 py-3">
          <NativeSelect
            className={cn("w-auto min-w-[9.5rem] font-medium", STATUS_STYLES[territory.status])}
            value={territory.status}
            onChange={(e) => onStatusChange(e.target.value as TerritoryStatus)}
          >
            {TERRITORY_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </NativeSelect>
        </td>
        <td className="px-4 py-3">
          <Badge className={DISPLAY_LEVEL_STYLES[territory.public_display_level]}>
            {DISPLAY_LEVEL_LABELS[territory.public_display_level]}
          </Badge>
        </td>
        <td className="px-4 py-3 text-secondary-foreground">
          {territory.definition_type === "zip_list" ? `${zipCount} ZIPs` : territory.radius_miles ? `${territory.radius_miles} mi` : "—"}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-3">
            {territory.definition_type === "zip_list" && (
              <button type="button" onClick={handleToggle} className="text-muted-foreground hover:text-foreground">
                {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              title="Delete territory"
              aria-label={`Delete ${territory.territory_name}`}
              className="text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            </button>
          </div>
        </td>
      </tr>
      {expanded && territory.definition_type === "zip_list" && (
        <tr>
          <td colSpan={6} className="bg-surface px-4 py-3.5">
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
            <div className="mt-2.5 flex gap-2">
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

/**
 * "Upload Territory Report": the primary way territories get marked off
 * going forward — upload the exact PDF the mapping software exports
 * ("Territory Demographic Report"), confirm the territory label and
 * status (reserved / pending sale / anything else in the existing status
 * list), and save. Nothing is written until the admin confirms the
 * preview — the parse step (POST .../reports/parse) only reads the file.
 */
function UploadReportCard({
  brandId,
  onSaved,
}: {
  brandId: string;
  onSaved: (territory: TerritoryDefinitionRecord, zipsAdded: number) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0); // bumped to clear the file input after save/cancel

  function reset() {
    setFile(null);
    setPreview(null);
    setParseError(null);
    setSaveError(null);
    setInputKey((k) => k + 1);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(null);
    setParseError(null);
    setParsing(true);
    try {
      const form = new FormData();
      form.append("file", selected);
      form.append("brandId", brandId);
      const response = await fetch("/api/advisor/territories/reports/parse", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setParseError(data.error ?? "Could not read this PDF");
        return;
      }
      setPreview({
        territoryName: data.territoryName ?? "",
        territoryCode: "",
        status: "reserved",
        publicDisplayLevel: "generalized",
        internalNotes: "",
        zips: data.zipCodes,
        excludedZips: new Set(),
        warnings: data.warnings ?? [],
      });
    } catch {
      setParseError("Could not upload — check your connection");
    } finally {
      setParsing(false);
    }
  }

  function toggleZip(zipCode: string) {
    if (!preview) return;
    const next = new Set(preview.excludedZips);
    if (next.has(zipCode)) next.delete(zipCode);
    else next.add(zipCode);
    setPreview({ ...preview, excludedZips: next });
  }

  async function handleConfirm() {
    if (!file || !preview) return;
    setSaving(true);
    setSaveError(null);
    try {
      const zipCodes = preview.zips.map((z) => z.zipCode).filter((z) => !preview.excludedZips.has(z));
      const form = new FormData();
      form.append("file", file);
      form.append(
        "payload",
        JSON.stringify({
          brandId,
          territoryName: preview.territoryName.trim(),
          territoryCode: preview.territoryCode.trim() || undefined,
          status: preview.status,
          publicDisplayLevel: preview.publicDisplayLevel,
          internalNotes: preview.internalNotes.trim() || undefined,
          zipCodes,
        }),
      );
      const response = await fetch("/api/advisor/territories/reports/confirm", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setSaveError(data.error ?? "Could not save this territory");
        return;
      }
      onSaved(data.territory, data.zipsAdded);
      reset();
    } catch {
      setSaveError("Could not save — check your connection");
    } finally {
      setSaving(false);
    }
  }

  const includedCount = preview ? preview.zips.length - preview.excludedZips.size : 0;

  return (
    <Card>
      <CardContent className="space-y-3.5 p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft">
            <FileUp className="size-4 text-primary" strokeWidth={1.8} />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Upload Territory Report</p>
            <p className="text-sm text-muted-foreground">
              Upload the Territory Demographic Report PDF exported from the mapping software. We read the
              territory name and ZIP codes from it — you choose the status and confirm before anything is saved.
            </p>
          </div>
        </div>

        {!preview && (
          <div className="flex items-center gap-3">
            <input
              key={inputKey}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              disabled={parsing}
              className="text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-control file:border-2 file:border-border-strong file:bg-card file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-surface"
            />
            {parsing && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>
        )}
        {parseError && <FieldError message={parseError} />}

        {preview && (
          <div className="space-y-3.5 rounded-control border-2 border-border-strong bg-surface p-4">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <Label htmlFor="reportTerritoryName">Territory label</Label>
                <Input
                  id="reportTerritoryName"
                  className="mt-1.5"
                  value={preview.territoryName}
                  onChange={(e) => setPreview({ ...preview, territoryName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="reportTerritoryCode">Territory code (optional)</Label>
                <Input
                  id="reportTerritoryCode"
                  className="mt-1.5"
                  value={preview.territoryCode}
                  onChange={(e) => setPreview({ ...preview, territoryCode: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="reportStatus">Mark as</Label>
                <NativeSelect
                  id="reportStatus"
                  className={cn("mt-1.5 font-medium", STATUS_STYLES[preview.status])}
                  value={preview.status}
                  onChange={(e) => setPreview({ ...preview, status: e.target.value as TerritoryStatus })}
                >
                  {REPORT_STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="reportDisplayLevel">Public display level</Label>
                <NativeSelect
                  id="reportDisplayLevel"
                  className="mt-1.5"
                  value={preview.publicDisplayLevel}
                  onChange={(e) => setPreview({ ...preview, publicDisplayLevel: e.target.value as PublicDisplayLevel })}
                >
                  {PUBLIC_DISPLAY_LEVELS.map((l) => (
                    <option key={l} value={l}>{DISPLAY_LEVEL_LABELS[l]}</option>
                  ))}
                </NativeSelect>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="reportNotes">Internal notes (never shown to prospects)</Label>
                <Textarea
                  id="reportNotes"
                  className="mt-1.5"
                  rows={2}
                  value={preview.internalNotes}
                  onChange={(e) => setPreview({ ...preview, internalNotes: e.target.value })}
                />
              </div>
            </div>

            {preview.warnings.length > 0 && (
              <div className="rounded-control border-2 border-[#f2cf8a] bg-[#fdf6e3] p-3 text-sm text-[#7a5b00]">
                {preview.warnings.map((warning, i) => (
                  <p key={i}>{warning}</p>
                ))}
              </div>
            )}

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-faint-foreground">
                {includedCount} of {preview.zips.length} ZIP code{preview.zips.length === 1 ? "" : "s"} will be saved
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {preview.zips.map((z) => {
                  const excluded = preview.excludedZips.has(z.zipCode);
                  return (
                    <span
                      key={z.zipCode}
                      title={z.conflict ? `Already ${STATUS_LABELS[z.conflict.status]} in "${z.conflict.territoryName}"` : undefined}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs",
                        excluded
                          ? "border-border bg-surface text-muted-foreground line-through"
                          : z.conflict
                            ? "border-destructive/40 bg-destructive/5 text-destructive"
                            : "border-border bg-card text-foreground",
                      )}
                    >
                      {z.conflict && !excluded && <AlertTriangle className="size-3" strokeWidth={2} />}
                      {z.zipCode}
                      {z.city ? ` — ${z.city}${z.stateCode ? `, ${z.stateCode}` : ""}` : ""}
                      <button
                        type="button"
                        onClick={() => toggleZip(z.zipCode)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={excluded ? `Include ${z.zipCode}` : `Exclude ${z.zipCode}`}
                      >
                        {excluded ? "+" : "×"}
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>

            {saveError && <FieldError message={saveError} />}

            <div className="flex gap-2">
              <Button
                type="button"
                disabled={saving || !preview.territoryName.trim() || includedCount === 0}
                onClick={handleConfirm}
              >
                {saving && <Loader2 className="animate-spin" />} Save Territory
              </Button>
              <Button type="button" variant="ghost" onClick={reset}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
