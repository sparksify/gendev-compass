"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import { STATUS_META } from "./statusMeta";
import { MAP_DISCLAIMER } from "@/lib/territory/messages";
import type { TerritoryAlternative, TerritoryEvaluationResult, TerritoryResultStatus } from "@/types/territory";

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

/** Continental US overview shown before the first search. */
const US_CENTER: [number, number] = [38.5, -96.5];
const US_ZOOM = 4;

export interface LiveTerritoryMapProps {
  token: string;
  /** Latest evaluation, or null before the first search (US overview). */
  result: TerritoryEvaluationResult | null;
  /** Fired when a prospect clicks a nearby-market marker on the map. */
  onSelectAlternative?: (alternative: TerritoryAlternative) => void;
  disabled?: boolean;
  /** Fill the parent's height (workspace split view) instead of fixed heights. */
  fill?: boolean;
}

/**
 * The hero map of the Territory Intelligence view: a real CARTO/OSM
 * basemap that flies to each searched market, drops an animated pin, draws
 * the preliminary evaluation radius, shades the prospect's own searched
 * ZIP boundaries in the result color, and marks nearby open markets as
 * clickable prospects. Shows nothing about other territories — no
 * statuses, ownership, or sold boundaries ever reach the browser (see
 * docs/territory-advisor.md).
 */
export function LiveTerritoryMap({ token, result, onSelectAlternative, disabled, fill }: LiveTerritoryMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const overlaysRef = useRef<LayerGroup | null>(null);
  const hasFlownRef = useRef(false);
  const selectAlternativeRef = useRef(onSelectAlternative);
  selectAlternativeRef.current = onSelectAlternative;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const latitude = result?.location.latitude ?? null;
  const longitude = result?.location.longitude ?? null;
  const status = result?.status ?? null;
  const radiusMiles = result?.evaluation.radiusMiles ?? 0;
  const searchedZip = result?.location.zipCode ?? null;
  const zipCodes = result?.evaluation.zipCodes ?? [];
  const locationLabel = result?.location.displayName ?? null;
  const alternatives = result?.alternatives ?? [];

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
        }).setView(US_CENTER, US_ZOOM);
        L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 18 }).addTo(mapRef.current);
        overlaysRef.current = L.layerGroup().addTo(mapRef.current);
      }
      const map = mapRef.current;
      const overlays = overlaysRef.current!;
      overlays.clearLayers();

      if (latitude == null || longitude == null || !status) return;

      const color = STATUS_COLORS[status] ?? "#2563eb";
      const statusLabel = STATUS_META[status]?.label ?? null;
      const radiusMeters = Math.max(radiusMiles, 1) * 1609.34;
      const bounds = L.latLng(latitude, longitude).toBounds(radiusMeters * 2);
      const reducedMotion =
        typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // Fly (animated) on subsequent searches; snap on the first render.
      if (hasFlownRef.current && !reducedMotion) {
        map.flyToBounds(bounds, { padding: [24, 24], duration: 1.3 });
      } else {
        map.fitBounds(bounds, { padding: [24, 24] });
      }
      hasFlownRef.current = true;

      // Preliminary evaluation radius.
      if (radiusMiles > 0) {
        L.circle([latitude, longitude], {
          radius: radiusMeters,
          color,
          weight: 2,
          dashArray: "6 6",
          fillColor: color,
          fillOpacity: 0.06,
          className: "ti-layer-in",
        }).addTo(overlays);
      }

      // Animated drop pin with a pulsing ring at the searched location.
      const pin = L.marker([latitude, longitude], {
        icon: L.divIcon({
          className: "",
          html:
            `<div class="ti-pin" style="position:relative;width:26px;height:26px;">` +
            `<span class="ti-pin-ring" style="position:absolute;inset:0;border-radius:9999px;background:${color};"></span>` +
            `<span style="position:absolute;inset:6px;border-radius:9999px;background:${color};border:2.5px solid #fff;box-shadow:0 1px 4px rgb(0 0 0 / 0.35);"></span>` +
            `</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
        keyboard: false,
      }).addTo(overlays);
      if (locationLabel) {
        pin.bindTooltip(locationLabel, { direction: "top", offset: [0, -10] });
      }

      // Nearby open markets as clickable prospects (already screened as
      // available by the evaluator — never any other territory's status).
      for (const alternative of alternatives) {
        if (alternative.status !== "AVAILABLE") continue;
        if (alternative.latitude == null || alternative.longitude == null) continue;
        const marker = L.circleMarker([alternative.latitude, alternative.longitude], {
          radius: 7,
          color: "#ffffff",
          weight: 2,
          fillColor: "#16a34a",
          fillOpacity: 0.95,
          className: "ti-layer-in",
        })
          .bindTooltip(`${alternative.label} — appears available. Click to analyze.`, {
            direction: "top",
            offset: [0, -8],
          })
          .addTo(overlays);
        marker.on("click", () => {
          if (!disabledRef.current) selectAlternativeRef.current?.(alternative);
        });
      }

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
              color,
              opacity: isSearched ? 0.9 : 0.45,
              weight: isSearched ? 2 : 1,
              fillColor: color,
              fillOpacity: isSearched ? 0.22 : 0.07,
              className: "ti-layer-in",
            };
          },
          onEachFeature: (feature, layer) => {
            const zip = feature?.properties?.zip;
            if (!zip) return;
            layer.bindTooltip(`ZIP ${zip}`, { sticky: true });
            // Click popup: public information only — the ZIP, its place in
            // this prospect's own search, and the overall (already shown)
            // result. Never any other territory's status or ownership.
            const isSearched = zip === searchedZip;
            const statusLine =
              isSearched && statusLabel
                ? `${statusLabel} — your searched ZIP`
                : "Evaluated in your current search";
            layer.bindPopup(
              `<div style="font: 12.5px/1.5 inherit; min-width: 140px;">` +
                `<strong>${locationLabel && isSearched ? locationLabel : `ZIP ${zip}`}</strong>` +
                `${locationLabel && isSearched ? `<br/>ZIP ${zip}` : ""}` +
                `<br/><span style="opacity:.75">${statusLine}</span>` +
                `</div>`,
              { closeButton: false },
            );
          },
        }).addTo(overlays);
        // Keep the pin above the boundary fills.
        pin.remove();
        pin.addTo(overlays);
      } catch {
        // Boundary overlay is optional; the base map already rendered.
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
    // Re-render per evaluation (checkedAt changes each search).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, result?.checkedAt]);

  // Tear the map down only on unmount.
  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
      overlaysRef.current = null;
    },
    [],
  );

  const meta = status ? STATUS_META[status] : null;

  return (
    <div
      className={`overflow-hidden rounded-card border border-border bg-surface ${
        fill ? "flex h-full min-h-0 flex-col" : ""
      }`}
    >
      <div className={fill ? "relative min-h-0 flex-1" : "relative"}>
        <div
          ref={containerRef}
          className={fill ? "h-full w-full" : "h-[380px] w-full md:h-[480px]"}
          role="img"
          aria-label={
            locationLabel
              ? `Map showing the preliminary evaluation area around ${locationLabel}${meta ? `: ${meta.label}` : ""}`
              : "United States territory map"
          }
        />
        {!result && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[500] flex justify-center">
            <p className="rounded-full border border-border bg-card/95 px-4 py-2 text-[12.5px] font-medium text-secondary-foreground shadow-sm">
              Search any city or ZIP code to begin exploring territory availability
            </p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border px-3.5 py-2.5">
        <p className="text-[11.5px] leading-snug text-muted-foreground">{MAP_DISCLAIMER}</p>
        {meta && (
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium ${meta.badgeClass}`}
          >
            <meta.icon className="size-3.5" strokeWidth={1.8} />
            {meta.label}
          </span>
        )}
      </div>
    </div>
  );
}
