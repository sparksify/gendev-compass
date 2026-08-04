import type { PortalChecklistItem } from "@/types/portal";

export function StepChecklist({ items }: { items: PortalChecklistItem[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-3">
          <span
            aria-hidden
            className={
              item.done
                ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white"
                : item.current
                  ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-brand bg-white"
                  : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-line bg-white"
            }
          >
            {item.done ? "✓" : ""}
          </span>
          <span
            className={
              item.done
                ? "text-sm text-ink"
                : item.current
                  ? "text-sm font-semibold text-ink"
                  : "text-sm text-ink-muted"
            }
          >
            {item.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
