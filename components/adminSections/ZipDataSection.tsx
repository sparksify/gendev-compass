"use client";

import { useState } from "react";

export function ZipDataSection({
  authHeaders,
  hideHeader = false,
}: {
  authHeaders: Record<string, string>;
  /** The dedicated admin page already renders a title — skip the card's own. */
  hideHeader?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [polygonBusy, setPolygonBusy] = useState<string | null>(null);
  const [polygonResult, setPolygonResult] = useState<string | null>(null);

  async function runPolygonSync() {
    setPolygonBusy("all");
    setPolygonResult(null);
    let loaded = 0;
    let written = 0;
    try {
      // The route loads as many states as fit in its time budget and reports
      // what's left; keep calling until the whole country is covered.
      for (let pass = 0; pass < 30; pass++) {
        const response = await fetch("/api/admin/import-polygons", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({}),
        });
        const data = await response.json();
        if (!data.success) {
          setPolygonResult(`Failed: ${data.error ?? response.status}`);
          return;
        }
        loaded += data.loadedStates.length;
        written += data.written;
        if (data.remainingStates.length === 0) {
          setPolygonResult(
            loaded === 0
              ? "All states already covered — nothing to load."
              : `Loaded ${written} boundary shapes across ${loaded} states. Full nationwide coverage.`,
          );
          return;
        }
        setPolygonResult(`Loading… ${data.remainingStates.length} states remaining.`);
      }
      setPolygonResult("Stopped after 30 passes — click again to continue.");
    } catch (error) {
      setPolygonResult(`Failed: ${error instanceof Error ? error.message : "network error"}`);
    } finally {
      setPolygonBusy(null);
    }
  }

  async function runImport() {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/import-zips", {
        method: "POST",
        headers: authHeaders,
      });
      const data = await response.json();
      setResult(
        data.success
          ? `Loaded ${data.written} ZIP codes nationwide.`
          : `Failed: ${data.error ?? response.status}`,
      );
    } catch (error) {
      setResult(`Failed: ${error instanceof Error ? error.message : "network error"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      {!hideHeader && <h3 className="text-sm font-semibold text-gray-900">Territory ZIP Data</h3>}
      <p className="mt-0.5 text-xs text-gray-500">
        Load the nationwide GeoNames ZIP reference (~41k ZIPs: city, state, county,
        coordinates) for the Territory Advisor. Safe to re-run; takes up to a minute.
      </p>
      <button
        onClick={runImport}
        disabled={busy}
        className="mt-3 rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {busy ? "Loading nationwide data…" : "Load Nationwide ZIP Data"}
      </button>
      {result && <p className="mt-2 text-xs text-gray-600">{result}</p>}

      <p className="mt-4 text-xs font-medium text-gray-700">Boundary shapes (nationwide)</p>
      <p className="mt-0.5 text-xs text-gray-500">
        Loads real ZIP boundary polygons for all 50 states + DC from data shipped inside the
        app (no external downloads). One click covers the whole country; already-covered
        states are skipped. The daily cron does this automatically too.
      </p>
      <button
        onClick={runPolygonSync}
        disabled={polygonBusy !== null}
        className="mt-2 rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {polygonBusy ? "Loading boundary shapes…" : "Load All Boundary Shapes"}
      </button>
      {polygonResult && <p className="mt-2 text-xs text-gray-600">{polygonResult}</p>}
    </div>
  );
}
