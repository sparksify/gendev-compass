import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STATUS_META } from "./statusMeta";
import type { TerritoryAlternative } from "@/types/territory";

interface AlternativesListProps {
  alternatives: TerritoryAlternative[];
  onSelect: (alternative: TerritoryAlternative) => void;
  disabled?: boolean;
}

export function AlternativesList({ alternatives, onSelect, disabled }: AlternativesListProps) {
  if (alternatives.length === 0) return null;

  return (
    <ul className="mt-3 flex flex-col gap-2">
      {alternatives.map((alt) => {
        const meta = STATUS_META[alt.status];
        return (
          <li
            key={`${alt.zipCode}-${alt.label}`}
            className="flex items-center justify-between gap-3 rounded-control border border-border bg-card px-3.5 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-foreground">{alt.label}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                {alt.distanceMiles != null && <span>{alt.distanceMiles} mi away</span>}
                <span className={`inline-flex items-center gap-1 font-medium ${meta.badgeClass.includes("text-") ? meta.badgeClass.split(" ").find((c) => c.startsWith("text-")) : ""}`}>
                  <meta.icon className="size-3" strokeWidth={2} />
                  {meta.label}
                </span>
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={() => onSelect(alt)}
            >
              Check <ArrowRight className="size-3.5" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
