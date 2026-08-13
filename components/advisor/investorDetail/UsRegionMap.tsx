import { MapPin } from "lucide-react";
import { REGION_PIN_POSITION, type UsRegion } from "@/lib/advisor/regions";
import { cn } from "@/lib/utils";

/**
 * A recognizable, hand-plotted continental-US silhouette (Florida peninsula,
 * Texas Gulf bulge, Cape Cod/Maine point, Great Lakes notches) with a pin
 * over the lead's region. Schematic, not survey-accurate — a quiet visual
 * anchor for the Location & Territory card, not a navigation tool (see
 * components/territory for the real interactive map).
 */
export function UsRegionMap({ region, className }: { region: UsRegion | null; className?: string }) {
  const pin = region ? REGION_PIN_POSITION[region] : null;

  return (
    <div className={cn("relative aspect-[5/3] w-full overflow-hidden", className)}>
      <svg viewBox="0 0 960 600" className="absolute inset-0 size-full" fill="none" aria-hidden>
        <path
          d="M110,70 L140,45 L300,40 L460,45 L520,70 L560,55 L600,90 L640,60 L660,110
             L700,85 L760,95 L790,70 L840,55 L870,90 L830,140 L860,160 L810,170 L830,190
             L790,200 L805,230 L770,245 L790,270 L760,290 L800,310 L770,330 L800,360
             L770,390 L800,430 L830,460 L810,500 L770,470 L720,430 L650,440 L600,450
             L560,460 L520,470 L490,510 L450,550 L400,520 L360,480 L320,440 L280,450
             L220,440 L170,460 L130,420 L100,370 L85,300 L75,230 L90,160 L110,100 Z"
          className="fill-[#dbe4f0] stroke-[#94a8c9]"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </svg>
      {pin && (
        <span
          className="absolute -translate-x-1/2 -translate-y-full"
          style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
        >
          <MapPin className="size-7 fill-primary text-primary drop-shadow-md" strokeWidth={1.5} />
        </span>
      )}
    </div>
  );
}
