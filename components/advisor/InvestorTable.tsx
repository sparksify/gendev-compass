import Link from "next/link";
import { StageBadge } from "./StageBadge";
import { FollowUpBadge } from "./FollowUpBadge";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/advisor/format";
import { labelForValue } from "@/lib/advisor/questionnaireCatalog";
import { FDD_STATUS_LABELS } from "@/lib/fdd/status";
import type { InvestorRow } from "@/lib/advisor/investors";

function consultationLabel(row: InvestorRow): string {
  if (row.activeAppointment) return row.activeAppointment.status === "RESCHEDULED" ? "Rescheduled" : "Scheduled";
  if (row.appointments.some((a) => a.status === "COMPLETED")) return "Completed";
  if (row.appointments.some((a) => a.status === "CANCELLED")) return "Cancelled";
  if (row.lead.booked_at) return "Scheduled";
  return "—";
}

function fddLabel(row: InvestorRow): string {
  return row.fddStatus === "not_requested" ? "—" : FDD_STATUS_LABELS[row.fddStatus];
}

/**
 * Dense investor table shared by the dashboard priority list and the
 * investor list page. Every row links to the investor detail record.
 */
export function InvestorTable({
  rows,
  showNextAction = false,
  emptyMessage = "No investors found.",
}: {
  rows: InvestorRow[];
  showNextAction?: boolean;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-faint-foreground">
            <th className="px-4 py-2.5 font-medium">Client</th>
            <th className="px-3 py-2.5 font-medium">Account</th>
            <th className="px-3 py-2.5 font-medium">Stage</th>
            <th className="px-3 py-2.5 font-medium">Advisor</th>
            <th className="px-3 py-2.5 font-medium">Liquid Capital</th>
            <th className="px-3 py-2.5 font-medium">Net Worth</th>
            <th className="px-3 py-2.5 font-medium">Timeline</th>
            <th className="px-3 py-2.5 font-medium">Video</th>
            <th className="px-3 py-2.5 font-medium">Consult</th>
            <th className="px-3 py-2.5 font-medium">FDD</th>
            <th className="px-3 py-2.5 font-medium">Last Activity</th>
            {showNextAction && <th className="px-3 py-2.5 font-medium">Next Action</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.lead.id} className="border-b border-border-soft hover:bg-surface">
              <td className="px-4 py-3">
                <Link
                  href={`/advisor/investors/${row.lead.id}`}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {row.lead.first_name} {row.lead.last_name}
                </Link>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{row.lead.state ?? "—"}</span>
                  <FollowUpBadge followUp={row.followUp} />
                </div>
              </td>
              <td className="px-3 py-3">
                {row.lead.intake_account ? (
                  <Badge variant={row.lead.intake_account === "GenDev" ? "primary" : "success"}>
                    {row.lead.intake_account}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-3 py-3">
                <StageBadge stage={row.lead.current_stage} />
              </td>
              <td className="px-3 py-3 text-secondary-foreground">
                {row.advisor ? `${row.advisor.first_name}` : "—"}
              </td>
              <td className="px-3 py-3 text-secondary-foreground">
                {labelForValue(row.questionnaire?.liquid_capital ?? row.lead.initial_liquid_capital)}
              </td>
              <td className="px-3 py-3 text-secondary-foreground">
                {labelForValue(row.questionnaire?.net_worth ?? row.lead.initial_net_worth)}
              </td>
              <td className="px-3 py-3 text-secondary-foreground">
                {labelForValue(row.questionnaire?.investment_timeline)}
              </td>
              <td className="px-3 py-3 text-secondary-foreground">
                {row.video ? `${Math.round(row.video.highest_percent_watched)}%` : "—"}
              </td>
              <td className="px-3 py-3 text-secondary-foreground">{consultationLabel(row)}</td>
              <td className="px-3 py-3 text-secondary-foreground">{fddLabel(row)}</td>
              <td className="px-3 py-3 text-muted-foreground">{formatRelative(row.lastActivityAt)}</td>
              {showNextAction && (
                <td className="px-3 py-3">
                  <Badge variant="outline" className="whitespace-nowrap">
                    {row.nextAction}
                  </Badge>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
