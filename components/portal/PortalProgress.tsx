import type { PortalChecklistItem } from "@/types/portal";

/** Thin overall progress bar shown at the top of portal steps. */
export function PortalProgress({ items }: { items: PortalChecklistItem[] }) {
  const done = items.filter((item) => item.done).length;
  const percent = Math.round((done / items.length) * 100);

  return (
    <div aria-label={`Portal progress: ${percent}%`} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span>
          Step {Math.min(done + 1, items.length)} of {items.length}
        </span>
        <span>{percent}% complete</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
