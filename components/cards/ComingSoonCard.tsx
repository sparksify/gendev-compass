import { FileText, Lock } from "lucide-react";
import type { ComingSoonItem } from "@/lib/config/content";

/** Disabled module row for features shipping in later releases (comp). */
export function ComingSoonCard({ item }: { item: ComingSoonItem }) {
  return (
    <div className="flex items-center gap-3 rounded-control border border-[#eceff3] bg-surface-raised px-[13px] py-[11px]">
      <FileText className="size-[18px] shrink-0 text-[#c3c9d2]" strokeWidth={1.5} />
      <span className="min-w-0 flex-1 text-[13px] leading-snug text-faint-foreground">
        {item.title}
      </span>
      <span className="flex shrink-0 items-center gap-[5px] text-[11px] text-faint-foreground">
        <Lock className="size-[11px]" strokeWidth={2} />
        Coming Soon
      </span>
    </div>
  );
}
