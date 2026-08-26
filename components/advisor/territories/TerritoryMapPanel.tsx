"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TerritoryStatus } from "@/types/territory";

/** Advisor map color language for territory statuses. */
const TERRITORY_COLORS: Record<TerritoryStatus, { color: string; label: string }> = {
  available: { color: "#16a34a", label: "Available" },
  reserved: { color: "#d97706", label: "Reserved" },
  sold: { color: "#dc2626", label: "Sold" },
  corporate: { color: "#7c3aed", label: "Corporate" },
  unavailable: { color: "#64748b", label: "Unavailable" },
  pending: { color: "#2563eb", label: "Pending" },
  archived: { color: "#94a3b8", label: "Archived" },
};

const TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

interface MapTerritory {
  id: string;
  name: string;
  code: string | null;
  type: string;
  status: TerritoryStatus;
  center: { latitude: number; longitude: number } | null;
  radiusMiles: number | null;
  zips: string[];
}

interface MapData {
  success: boolean;
  error?: string;
  brand: { id: string; name: string; slug: string };
  brands: Array<{ id: string; name: string; slug: string }>;
  territories: MapTerritory[];
  eligibility: Array<{ state: string; status: string }>;
  zipGeometry: {
    type: "FeatureCollection";
    features: Array<{ type: "Feature"; properties: { zip: string }; geometry: unknown }>;
  };
}

/**
 * The advisor-facing interactive territory map: every territory for the
 * brand rendered on a real basemap — ZIP-list territories as their merged
 * Census boundary shapes, radius territories as circles — color-coded by
 * status with click-through details. Staff only (exact boundaries are never
 * shown to prospects).
 */
export function TerritoryMapPanel() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const overlaysRef = useRef<LayerGroup | null>(null);
  const [data, setData] = useState<MapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missingBoundaries, setMissingBoundaries] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/advisor/territories/map-data")
      .then(async (response) => {
        const body = (await response.json()) as MapData;
        if (cancelled) return;
        if (!response.ok || !body.success) {
          setError(body.error ?? `Failed to load map data (${response.status})`);
          return;
        }
        setData(body);
      })
      .catch(() => !cancelled && setError("Failed to load map data"));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;

    async function render() {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || !data) return;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, { zoomControl: true });
        L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 18 }).addTo(mapRef.current);
        overlaysRef.current = L.layerGroup().addTo(mapRef.current);
      }
      const map = mapRef.current;
      const overlays = overlaysRef.current!;
      overlays.clearLayers();

      const geometryByZip = new Map(
        data.zipGeometry.features.map((f) => [f.properties.zip, f]),
      );
      const bounds = L.latLngBounds([]);
      let missing = 0;

      for (const territory of data.territories) {
        const { color, label } = TERRITORY_COLORS[territory.status] ?? TERRITORY_COLORS.pending;
        const popup = `<strong>${territory.name}</strong><br/>${
          territory.code ? `Code: ${territory.code}<br/>` : ""
        }Status: ${label}<br/>Type: ${territory.type}${
          territory.zips.length ? `<br/>ZIPs: ${territory.zips.length}` : ""
        }`;

        if (territory.type === "radius" && territory.center && territory.radiusMiles) {
          const radiusMeters = territory.radiusMiles * 1609.34;
          L.circle([territory.center.latitude, territory.center.longitude], {
            radius: radiusMeters,
            color,
            weight: 2,
            fillColor: color,
            fillOpacity: 0.18,
          })
            .bindPopup(popup)
            .addTo(overlays);
          // L.Circle#getBounds needs an initialized view — derive bounds
          // straight from the coordinates instead.
          bounds.extend(
            L.latLng(territory.center.latitude, territory.center.longitude).toBounds(
              radiusMeters * 2,
            ),
          );
          continue;
        }

        for (const zip of territory.zips) {
          const feature = geometryByZip.get(zip);
          if (!feature) {
            missing += 1;
            continue;
          }
          const layer = L.geoJSON(feature as never, {
            style: { color, weight: 1.5, fillColor: color, fillOpacity: 0.22 },
          })
            .bindPopup(`${popup}<br/>ZIP ${zip}`)
            .addTo(overlays);
          bounds.extend(layer.getBounds());
        }
      }

      setMissingBoundaries(missing);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [24, 24] });
      } else {
        map.setView([37.8, -96.9], 4); // continental US
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [data]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
      overlaysRef.current = null;
    },
    [],
  );

  if (error) {
    return (
      <div className="rounded-card border border-border bg-surface p-6 text-[15.5px] leading-[1.45] text-muted-foreground">
        {error}
      </div>
    );
  }

  const usedStatuses = new Set(data?.territories.map((t) => t.status) ?? []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {[...usedStatuses].map((status) => {
            const meta = TERRITORY_COLORS[status] ?? TERRITORY_COLORS.pending;
            return (
              <span key={status} className="inline-flex items-center gap-1.5 text-[13.5px] leading-[1.45] text-secondary-foreground">
                <span className="size-3 rounded-sm" style={{ backgroundColor: meta.color, opacity: 0.7 }} />
                {meta.label}
              </span>
            );
          })}
          {usedStatuses.size === 0 && data && (
            <span className="text-[13.5px] leading-[1.45] text-muted-foreground">
              No territories defined yet — add records under Territory Records.
            </span>
          )}
        </div>
        {data && (
          <span className="text-[13.5px] leading-[1.45] text-muted-foreground">
            {data.brand.name} · {data.territories.length} territor{data.territories.length === 1 ? "y" : "ies"}
          </span>
        )}
      </div>
      <div className="overflow-hidden rounded-card border border-border">
        <div ref={containerRef} className="isolate h-[560px] w-full" role="application" aria-label="Territory map" />
      </div>
      {missingBoundaries > 0 && (
        <p className="text-[13.5px] leading-[1.45] text-muted-foreground">
          {missingBoundaries} territory ZIP{missingBoundaries === 1 ? "" : "s"} have no boundary shape
          loaded yet — load state polygons from the Admin page (Territory ZIP Data).
        </p>
      )}
      <p className="text-[13.5px] leading-[1.45] text-muted-foreground">
        Internal map — exact territory boundaries are never shown to prospects.
      </p>
    </div>
  );
}
