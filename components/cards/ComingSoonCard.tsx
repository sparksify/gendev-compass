import { FileText, Lock } from "lucide-react";
import type { ComingSoonItem } from "@/lib/config/content";

/** Disabled module row for features shipping in later releases. */
export function ComingSoonCard({ item }: { item: ComingSoonItem }) {
  return (
    <div className="flex items-center gap-3 rounded-[10px] bg-surface p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground/70">
        <FileText className="size-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-muted-foreground">
        {item.title}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground/70">
        <Lock className="size-3" />
        Coming Soon
      </span>
    </div>
  );
}
