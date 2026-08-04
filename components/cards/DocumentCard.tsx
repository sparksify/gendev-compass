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
      <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary">
        <FileText className="size-4" />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium text-foreground">{item.title}</span>
        <span className="block text-xs text-muted-foreground">
          {item.href ? item.kind : `${item.kind} — available soon`}
        </span>
      </span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </>
  );

  const baseClass =
    "flex w-full items-center gap-3 rounded-card border border-border bg-card p-3 text-left transition-colors";

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
