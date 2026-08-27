import { Panel, PanelHeader } from "@/components/advisor/v3";
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
  const shown = events.slice(0, 5);

  return (
    <Panel id="activity" className="scroll-mt-4">
      <PanelHeader
        title="Recent Activity"
        meta={
          events.length > shown.length ? (
            <a href="#activity" className="text-[12px] font-bold text-primary hover:underline">
              View all {events.length}
            </a>
          ) : undefined
        }
      />

      {events.length === 0 ? (
        <p className="py-2 text-[13px] text-muted-foreground">No recorded activity yet.</p>
      ) : (
        <div className="mt-1 flex flex-col text-[13px] text-secondary-foreground">
          {shown.map((event) => (
            <span
              key={event.id}
              className="flex justify-between gap-2.5 border-b border-border-soft py-2 last:border-b-0"
            >
              <span className="min-w-0">
                <span
                  aria-hidden
                  className="mr-2.5 inline-block size-1.5 rounded-full align-[2px]"
                  style={{ backgroundColor: eventColor(event.event_name) }}
                />
                {eventLabel(event.event_name)}
              </span>
              <span className="tabular shrink-0 font-semibold text-faint-foreground">
                {relativeShort(event.created_at)}
              </span>
            </span>
          ))}
        </div>
      )}
    </Panel>
  );
}
