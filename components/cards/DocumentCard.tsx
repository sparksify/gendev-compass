import { ChevronRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResourceItem } from "@/lib/config/content";

/**
 * A single resource row (comp: Resource Library). Items without a configured
 * URL render as not-yet-available rather than pretending to download.
 */
export function DocumentCard({ item }: { item: ResourceItem }) {
  const inner = (
    <>
      <FileText className="size-[19px] shrink-0 text-primary" strokeWidth={1.5} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-foreground">
          {item.title}
        </span>
        <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
          {item.href ? item.kind : `${item.kind} — available soon`}
        </span>
      </span>
      <ChevronRight className="size-3.5 shrink-0 text-faint-foreground" strokeWidth={1.9} />
    </>
  );

  const baseClass =
    "flex w-full items-center gap-3 rounded-control border border-border bg-card px-[13px] py-[11px] text-left transition-colors";

  if (!item.href) {
    return <div className={cn(baseClass, "opacity-60")}>{inner}</div>;
  }

  return (
    <a
      href={item.href}
      target="_blank"
      rel="noreferrer"
      className={cn(baseClass, "hover:border-border-strong hover:bg-surface-raised")}
    >
      {inner}
    </a>
  );
}
