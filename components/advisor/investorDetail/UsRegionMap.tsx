import { MapPin } from "lucide-react";
import { REGION_PIN_POSITION, type UsRegion } from "@/lib/advisor/regions";
import { cn } from "@/lib/utils";

/**
 * Decorative, stylized continental-US silhouette with a pin over the lead's
 * region. Schematic, not geographically precise — a quiet visual anchor for
 * the Location & Territory card, not a navigation tool (see
 * components/territory for the real interactive map).
 */
export function UsRegionMap({ region, className }: { region: UsRegion | null; className?: string }) {
  const pin = region ? REGION_PIN_POSITION[region] : null;

  return (
    <div className={cn("relative aspect-[5/3] w-full overflow-hidden", className)}>
      <svg
        viewBox="0 0 300 180"
        className="absolute inset-0 size-full text-border-strong"
        fill="none"
        aria-hidden
      >
        <path
          d="M40 60 L70 42 L100 40 L120 28 L150 22 L185 26 L215 22 L245 32 L265 46 L278 62 L272 82 L280 96 L268 112 L272 128 L250 140 L238 156 L212 152 L198 164 L170 158 L150 168 L128 158 L104 162 L86 148 L62 150 L48 134 L54 116 L38 104 L44 86 Z"
          fill="currentColor"
          fillOpacity="0.12"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="1.5"
        />
      </svg>
      {pin && (
        <span
          className="absolute -translate-x-1/2 -translate-y-full"
          style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
        >
          <MapPin className="size-6 fill-primary text-primary drop-shadow-sm" strokeWidth={1.5} />
        </span>
      )}
    </div>
  );
}
