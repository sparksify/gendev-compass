import { cn } from "@/lib/utils";
import { leadSourceMeta } from "@/lib/config/leadSources";

/** Lead-source pill used in the clients table and client detail surfaces. */
export function SourceBadge({ source, className }: { source: string | null; className?: string }) {
  const meta = leadSourceMeta(source);
  if (!meta) {
    return <span className="text-[13px] text-faint-foreground">—</span>;
  }
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold",
        meta.badgeClass,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
