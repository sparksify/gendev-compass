"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import { STATUS_META } from "./statusMeta";
import { MAP_DISCLAIMER } from "@/lib/territory/messages";
import type { TerritoryResultStatus } from "@/types/territory";

/** Map stroke/fill colors per result status (paired with label + icon elsewhere). */
const STATUS_COLORS: Partial<Record<TerritoryResultStatus, string>> = {
  AVAILABLE: "#16a34a",
  PARTIALLY_AVAILABLE: "#d97706",
  UNAVAILABLE: "#dc2626",
  STATE_RESTRICTED: "#dc2626",
  MANUAL_REVIEW: "#2563eb",
};

const TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export interface LiveTerritoryMapProps {
  token: string;
  status: TerritoryResultStatus;
  latitude: number;
  longitude: number;
  radiusMiles: number;
  locationLabel: string | null;
  /** ZIPs inside the evaluation radius (the prospect's own search area). */
  zipCodes: string[];
  /** The searched ZIP itself, highlighted when boundary data exists. */
  searchedZip: string | null;
}

/**
 * Real tile-based map of the prospect's own evaluation area: CARTO/OSM
 * basemap, the searched point, the preliminary radius, and public Census
 * ZIP boundaries for the searched area (fetched per portal token). Shows
 * nothing about territories — no statuses, ownership, or sold boundaries
 * (those never reach the browser; see docs/territory-advisor.md).
 */
export function LiveTerritoryMap({
  token,
  status,
  latitude,
  longitude,
  radiusMiles,
  locationLabel,
  zipCodes,
  searchedZip,
}: LiveTerritoryMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const overlaysRef = useRef<LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          zoomControl: true,
          attributionControl: true,
          scrollWheelZoom: false,
        });
        L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 18 }).addTo(mapRef.current);
        overlaysRef.current = L.layerGroup().addTo(mapRef.current);
      }
      const map = mapRef.current;
      const overlays = overlaysRef.current!;
      overlays.clearLayers();

      const color = STATUS_COLORS[status] ?? "#2563eb";
      const radiusMeters = radiusMiles * 1609.34;

      // Fit the view first: L.Circle#getBounds needs an initialized view, so
      // derive bounds straight from the coordinates instead.
      map.fitBounds(L.latLng(latitude, longitude).toBounds(radiusMeters * 2), {
        padding: [16, 16],
      });

      // Evaluation radius + searched point.
      L.circle([latitude, longitude], {
        radius: radiusMeters,
        color,
        weight: 2,
        dashArray: "6 6",
        fillColor: color,
        fillOpacity: 0.08,
      }).addTo(overlays);
      L.circleMarker([latitude, longitude], {
        radius: 6,
        color: "#ffffff",
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      })
        .bindTooltip(locationLabel ?? "Searched location", { direction: "top", offset: [0, -6] })
        .addTo(overlays);

      // Public ZIP boundaries for the prospect's own search area
      // (progressive enhancement — the map is complete without them).
      try {
        const response = await fetch(
          `/api/portal/${token}/territory-advisor/geometry?zips=${zipCodes.slice(0, 80).join(",")}`,
        );
        if (!response.ok || cancelled) return;
        const collection = await response.json();
        if (cancelled || !collection?.features?.length) return;
        L.geoJSON(collection, {
          style: (feature) => {
            const isSearched = feature?.properties?.zip === searchedZip;
            return {
              color: isSearched ? color : "#94a3b8",
              weight: isSearched ? 2 : 1,
              fillColor: isSearched ? color : "#94a3b8",
              fillOpacity: isSearched ? 0.12 : 0.04,
            };
          },
          onEachFeature: (feature, layer) => {
            if (feature?.properties?.zip) {
              layer.bindTooltip(`ZIP ${feature.properties.zip}`, { sticky: true });
            }
          },
        }).addTo(overlays);
      } catch {
        // Boundary overlay is optional; the base map already rendered.
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [token, status, latitude, longitude, radiusMiles, locationLabel, zipCodes, searchedZip]);

  // Tear the map down only on unmount.
  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
      overlaysRef.current = null;
    },
    [],
  );

  const meta = STATUS_META[status];

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <div
        ref={containerRef}
        className="aspect-[4/3] w-full"
        role="img"
        aria-label={
          locationLabel
            ? `Map showing the preliminary evaluation area around ${locationLabel}: ${meta.label}`
            : "Territory evaluation map"
        }
      />
      <div className="flex items-center justify-between gap-3 border-t border-border px-3.5 py-2.5">
        <p className="text-[11.5px] leading-snug text-muted-foreground">{MAP_DISCLAIMER}</p>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium ${meta.badgeClass}`}
        >
          <meta.icon className="size-3.5" strokeWidth={1.8} />
          {meta.label}
        </span>
      </div>
    </div>
  );
}
