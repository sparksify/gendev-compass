import { eventLabel } from "@/lib/advisor/format";
import { DISCOVERY_STAGES, SIGNAL } from "@/lib/advisor/discoveryStages";
import { relativeShort } from "@/components/advisor/dashboard/panels";
import type { PortalEventRecord } from "@/types/analytics";

/** Semantic dot color: what kind of moment this was, not which stage. */
function eventColor(name: string): string {
  if (/cancel|failed|error|no_show|not_a_fit|review_required/.test(name)) return SIGNAL.alert;
  if (/completed|submitted|qualified|eligible|invested|received/.test(name)) return SIGNAL.success;
  if (/fdd/.test(name)) return DISCOVERY_STAGES[2].color;
  if (/book|calendar|appointment|consultation|advisor/.test(name)) return DISCOVERY_STAGES[1].color;
  return DISCOVERY_STAGES[0].color;
}

/** The activity list: a semantic dot, the event, and a relative time. */
export function ActivityRail({ events }: { events: PortalEventRecord[] }) {
  if (events.length === 0) {
    return <p className="py-2 text-[12.5px] text-muted-foreground">No recorded activity yet.</p>;
  }

  return (
    <div className="flex flex-col text-[12.5px] text-secondary-foreground">
      {events.slice(0, 12).map((event) => (
        <span
          key={event.id}
          className="flex justify-between gap-2.5 border-b border-[#f6f6f7] py-2.5 last:border-b-0"
        >
          <span className="min-w-0">
            <span
              aria-hidden
              className="mr-2 inline-block size-1.5 rounded-full"
              style={{ backgroundColor: eventColor(event.event_name) }}
            />
            {eventLabel(event.event_name)}
          </span>
          <span className="tabular shrink-0 text-ghost-foreground">
            {relativeShort(event.created_at)}
          </span>
        </span>
      ))}
    </div>
  );
}
