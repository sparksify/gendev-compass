import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ComingSoonItem } from "@/lib/config/content";

/** Disabled module row for features shipping in later releases. */
export function ComingSoonCard({ item }: { item: ComingSoonItem }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-dashed border-border bg-card p-3 opacity-70">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-surface text-muted-foreground">
        <Lock className="size-4" />
      </span>
      <span className="flex-1 text-sm font-medium text-muted-foreground">{item.title}</span>
      <Badge variant="outline">Coming Soon</Badge>
    </div>
  );
}
