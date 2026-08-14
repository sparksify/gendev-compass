import Link from "next/link";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { StageBadge } from "./StageBadge";
import { NextActionPill } from "./NextActionPill";
import { MiniVideoRing } from "./MiniVideoRing";
import { RowActionsMenu } from "./RowActionsMenu";
import { InitialsAvatar } from "./investorDetail/InitialsAvatar";
import { formatDate, formatRelative } from "@/lib/advisor/format";
import { labelForValue } from "@/lib/advisor/questionnaireCatalog";
import { FDD_STATUS_LABELS } from "@/lib/fdd/status";
import { getAppUrl } from "@/lib/config/env";
import { cn } from "@/lib/utils";
import type { InvestorRow, InvestorSortKey } from "@/lib/advisor/investors";

function consultationLabel(row: InvestorRow): string {
  if (row.activeAppointment) return row.activeAppointment.status === "RESCHEDULED" ? "Rescheduled" : "Scheduled";
  if (row.appointments.some((a) => a.status === "COMPLETED")) return "Completed";
  if (row.appointments.some((a) => a.status === "CANCELLED")) return "Cancelled";
  if (row.lead.booked_at) return "Scheduled";
  return "—";
}

function consultationDate(row: InvestorRow): string | null {
  const when = row.activeAppointment?.scheduled_start ?? row.lead.appointment_start_at;
  return when ? formatDate(when) : null;
}

function fddLabel(row: InvestorRow): string {
  return row.fddStatus === "not_requested" ? "—" : FDD_STATUS_LABELS[row.fddStatus];
}

interface SortConfig {
  activeKey: InvestorSortKey | null;
  activeDir: "asc" | "desc";
  hrefFor: (key: InvestorSortKey) => string;
}

const COLUMNS: Array<{ key: InvestorSortKey | null; label: string }> = [
  { key: "client", label: "Client" },
  { key: "stage", label: "Stage" },
  { key: "advisor", label: "Advisor" },
  { key: "liquidCapital", label: "Liquid Capital" },
  { key: "netWorth", label: "Net Worth" },
  { key: "video", label: "Video" },
  { key: null, label: "Consultation" },
  { key: null, label: "FDD" },
  { key: "lastActivity", label: "Last Activity" },
];

function ColumnHeader({ column, sort }: { column: (typeof COLUMNS)[number]; sort?: SortConfig }) {
  if (!column.key || !sort) {
    return <th className="px-3 py-2.5 font-medium">{column.label}</th>;
  }
  const active = sort.activeKey === column.key;
  const Icon = active ? (sort.activeDir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <th className="px-3 py-2.5 font-medium">
      <Link
        href={sort.hrefFor(column.key)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-secondary-foreground",
          active && "text-secondary-foreground",
        )}
      >
        {column.label}
        <Icon className="size-3" />
      </Link>
    </th>
  );
}

/**
 * Dense investor table shared by the dashboard priority list and the
 * investor list page. Every row links to the investor detail record.
 * `sort` is optional — the dashboard's simpler priority list renders plain
 * (non-interactive) headers by omitting it.
 */
export function InvestorTable({
  rows,
  showNextAction = false,
  showRowActions = false,
  emptyMessage = "No investors found.",
  sort,
}: {
  rows: InvestorRow[];
  showNextAction?: boolean;
  /** Adds the per-row "..." menu (view details / copy portal link). Kept
   * separate from showNextAction since the dashboard's priority list uses
   * neither. */
  showRowActions?: boolean;
  emptyMessage?: string;
  sort?: SortConfig;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
    );
  }

  const appUrl = getAppUrl();

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1000px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-faint-foreground">
            {COLUMNS.map((column) => (
              <ColumnHeader key={column.label} column={column} sort={sort} />
            ))}
            {showNextAction && <th className="px-3 py-2.5 font-medium">Next Action</th>}
            {showRowActions && <th className="px-3 py-2.5" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const fullName = `${row.lead.first_name} ${row.lead.last_name}`;
            const date = consultationDate(row);
            return (
              <tr key={row.lead.id} className="border-b border-border-soft hover:bg-surface">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <InitialsAvatar name={fullName} size="sm" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/advisor/investors/${row.lead.id}`}
                          className="font-medium text-foreground hover:text-primary"
                        >
                          {fullName}
                        </Link>
                        {row.followUp.needed && (
                          <span
                            className="size-1.5 shrink-0 rounded-full bg-[#d97706]"
                            title={row.followUp.reasons.join("\n")}
                            aria-label="Needs follow-up"
                          />
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{row.lead.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <StageBadge stage={row.lead.current_stage} />
                </td>
                <td className="px-3 py-3 text-secondary-foreground">
                  {row.advisor ? `${row.advisor.first_name} ${row.advisor.last_name}` : "—"}
                </td>
                <td className="px-3 py-3 text-secondary-foreground">
                  {labelForValue(row.questionnaire?.liquid_capital ?? row.lead.initial_liquid_capital)}
                </td>
                <td className="px-3 py-3 text-secondary-foreground">
                  {labelForValue(row.questionnaire?.net_worth ?? row.lead.initial_net_worth)}
                </td>
                <td className="px-3 py-3">
                  {row.video ? (
                    <MiniVideoRing percent={row.video.highest_percent_watched} completed={row.video.completed} />
                  ) : (
                    <span className="text-secondary-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-secondary-foreground">
                  {consultationLabel(row)}
                  {date && <span className="block text-xs text-muted-foreground">{date}</span>}
                </td>
                <td className="px-3 py-3 text-secondary-foreground">{fddLabel(row)}</td>
                <td className="px-3 py-3 text-muted-foreground">{formatRelative(row.lastActivityAt)}</td>
                {showNextAction && (
                  <td className="px-3 py-3">
                    <NextActionPill action={row.nextAction} />
                  </td>
                )}
                {showRowActions && (
                  <td className="px-3 py-3 text-right">
                    <RowActionsMenu
                      investorId={row.lead.id}
                      portalUrl={`${appUrl}/p/${row.lead.portal_token}`}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
