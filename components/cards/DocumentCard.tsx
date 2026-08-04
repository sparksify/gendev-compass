import { ChevronRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResourceItem } from "@/lib/config/content";

/**
 * A single resource row. Items without a configured URL render as
 * not-yet-available rather than pretending to download something.
 */
export function DocumentCard({ item }: { item: ResourceItem }) {
  const inner = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <FileText className="size-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-foreground">
          {item.title}
        </span>
        <span className="block text-xs text-muted-foreground">
          {item.href ? item.kind : `${item.kind} — available soon`}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" />
    </>
  );

  const baseClass =
    "flex w-full items-center gap-3 rounded-[10px] border border-border bg-card p-3 text-left transition-colors";

  if (!item.href) {
    return <div className={cn(baseClass, "opacity-60")}>{inner}</div>;
  }

  return (
    <a
      href={item.href}
      target="_blank"
      rel="noreferrer"
      className={cn(baseClass, "hover:border-primary/40 hover:bg-primary-soft/40")}
    >
      {inner}
    </a>
  );
}
