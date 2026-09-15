import { AlertTriangle } from "lucide-react";
import { Panel } from "@/components/advisor/v3";
import type { RecentAcquisitionFunnel as Funnel } from "@/lib/advisor/acquisitionFunnel";

function Metric({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="min-w-0 border-l border-border-soft pl-3 first:border-l-0 first:pl-0 sm:pl-4">
      <p className="tabular text-[24px] font-extrabold leading-none text-foreground">{value}</p>
      <p className="mt-1 text-[12px] font-bold text-secondary-foreground">{label}</p>
      <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{note}</p>
    </div>
  );
}

export function RecentAcquisitionFunnel({ funnel }: { funnel: Funnel }) {
  return (
    <Panel className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[15px] font-bold text-foreground">Lead follow-through · last 24 hours</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {funnel.facebookAttributed} of {funnel.newLeads} new leads have Facebook attribution.
          </p>
        </div>
        <p className="text-[11px] font-semibold text-faint-foreground">
          Lead-level activity · refreshes with this page
        </p>
      </div>

      <div className="grid grid-cols-2 gap-y-4 sm:grid-cols-3 lg:grid-cols-7">
        <Metric label="New leads" value={funnel.newLeads} note="Created in Compass" />
        <Metric label="Bridge opened" value={funnel.bridgeOpened} note="Personal /watch link" />
        <Metric label="Portal opened" value={funnel.portalOpened} note="Research Center" />
        <Metric label="Video play" value={funnel.videoStarted} note="Play was clicked" />
        <Metric label="Watched 1%+" value={funnel.measurableVideo} note="Progress confirmed" />
        <Metric label="Completed" value={funnel.videoCompleted} note="Video threshold met" />
        <Metric label="Booked" value={funnel.booked} note="Appointment recorded" />
      </div>

      {funnel.portalWithoutBridge > 0 && (
        <div className="flex items-start gap-2 rounded-[7px] bg-warning-soft px-3 py-2 text-[12px] text-warning">
          <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <p>
            {funnel.portalWithoutBridge} {funnel.portalWithoutBridge === 1 ? "lead opened" : "leads opened"} the
            Research Center without opening the bridge. This usually means an older direct portal link was sent.
          </p>
        </div>
      )}
    </Panel>
  );
}
