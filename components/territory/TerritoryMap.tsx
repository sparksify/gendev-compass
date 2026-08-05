"use client";

import { MapPin, MapPinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_META } from "./statusMeta";
import { MAP_DISCLAIMER } from "@/lib/territory/messages";
import type { TerritoryResultStatus } from "@/types/territory";

interface TerritoryMapProps {
  status: TerritoryResultStatus | null;
  radiusMiles: number;
  locationLabel: string | null;
  overlapPercentage: number;
  loading?: boolean;
}

/**
 * A clean, dependency-free schematic map — not a tile-based GIS view. It
 * shows the searched point, a translucent preliminary evaluation radius, and
 * (when relevant) a generalized overlap indicator. It never plots real
 * territory boundaries or coordinates — those aren't sent to the browser at
 * all (see lib/territory/evaluate.ts, which only returns sanitized data).
 */
export function TerritoryMap({ status, radiusMiles, locationLabel, overlapPercentage, loading }: TerritoryMapProps) {
  const meta = status ? STATUS_META[status] : null;
  const showsArea = status !== null && status !== "LOCATION_NOT_FOUND" && status !== "BRAND_NOT_CONFIGURED";

  // Purely visual scale — not a real projection. Bigger radius selection reads as a bigger circle.
  const outerRadius = 34 + (Math.min(radiusMiles, 25) / 25) * 46;
  const overlapRadius = overlapPercentage > 0 ? outerRadius * Math.min(0.85, 0.3 + overlapPercentage / 150) : 0;

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <div
        className="relative flex aspect-[4/3] w-full items-center justify-center"
        role="img"
        aria-label={
          loading
            ? "Loading map"
            : meta && locationLabel
              ? `Map showing the preliminary evaluation area around ${locationLabel}: ${meta.label}`
              : "Territory map"
        }
      >
        {loading ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
            <p className="text-xs">Loading map…</p>
          </div>
        ) : !status ? (
          <div className="flex flex-col items-center gap-2 px-6 text-center text-muted-foreground">
            <MapPin className="size-6" strokeWidth={1.6} />
            <p className="text-xs">Search a market to see it here.</p>
          </div>
        ) : status === "LOCATION_NOT_FOUND" ? (
          <div className="flex flex-col items-center gap-2 px-6 text-center text-muted-foreground">
            <MapPinOff className="size-6" strokeWidth={1.6} />
            <p className="text-xs">We couldn&apos;t place that location on the map.</p>
          </div>
        ) : (
          <svg viewBox="0 0 200 150" className="h-full w-full" aria-hidden="true">
            {/* Faint grid to read as "map", without simulating real streets/geography. */}
            <defs>
              <pattern id="territory-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--border-soft)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="200" height="150" fill="url(#territory-grid)" />

            {showsArea && meta && (
              <>
                <circle
                  cx="100"
                  cy="75"
                  r={outerRadius}
                  className={cn(meta.mapClass)}
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                {overlapRadius > 0 && (
                  <circle
                    cx="112"
                    cy="68"
                    r={overlapRadius}
                    className={cn(meta.mapClass)}
                    fillOpacity={0.5}
                    strokeWidth="1"
                  />
                )}
              </>
            )}

            <circle cx="100" cy="75" r="4.5" className={meta ? meta.mapClass : "fill-primary stroke-primary"} strokeWidth="1.5" />
            <circle cx="100" cy="75" r="2" fill="currentColor" className={meta ? meta.mapClass : "text-primary"} />
          </svg>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border bg-card px-3.5 py-2.5">
        <p className="text-[11px] text-faint-foreground">{MAP_DISCLAIMER}</p>
        {meta && !loading && (
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <meta.icon className="size-3.5" strokeWidth={1.8} />
            {meta.label}
          </span>
        )}
      </div>
    </div>
  );
}
