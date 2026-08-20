import Link from "next/link";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { StageBadge } from "./StageBadge";
import { NextActionPill } from "./NextActionPill";
import { MiniVideoRing } from "./MiniVideoRing";
import { RowActionsMenu } from "./RowActionsMenu";
import { InitialsAvatar } from "./investorDetail/InitialsAvatar";
import { formatRelative } from "@/lib/advisor/format";
import { labelForValue } from "@/lib/advisor/questionnaireCatalog";
import { getAppUrl } from "@/lib/config/env";
import { cn } from "@/lib/utils";
import type { InvestorRow, InvestorSortKey } from "@/lib/advisor/investors";

interface SortConfig {
  activeKey: InvestorSortKey | null;
  activeDir: "asc" | "desc";
  hrefFor: (key: InvestorSortKey) => string;
}

// Net Worth, Consultation, and FDD were dropped from the list view — that
// detail lives one click away on the client detail page, and cutting them
// let the remaining columns breathe instead of competing for space.
const COLUMNS: Array<{ key: InvestorSortKey | null; label: string }> = [
  { key: "client", label: "Client" },
  { key: "stage", label: "Stage" },
  { key: "advisor", label: "Advisor" },
  { key: "liquidCapital", label: "Liquid Capital" },
  { key: "video", label: "Video" },
  { key: "lastActivity", label: "Last Activity" },
];

function ColumnHeader({ column, sort }: { column: (typeof COLUMNS)[number]; sort?: SortConfig }) {
  if (!column.key || !sort) {
    return <th className="px-3.5 py-2.5 font-medium">{column.label}</th>;
  }
  const active = sort.activeKey === column.key;
  const Icon = active ? (sort.activeDir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <th className="px-3.5 py-2.5 font-medium">
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
  // The Next Action / row-menu columns are pinned to the right edge of the
  // scroll container (rather than scrolling away with the rest of the wide
  // table) so they stay reachable without a horizontal scroll on narrower
  // screens. Widths are fixed so the sticky offsets below stay accurate.
  const rowActionsColWidth = 48;
  const nextActionColWidth = 192;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-faint-foreground">
            {COLUMNS.map((column) => (
              <ColumnHeader key={column.label} column={column} sort={sort} />
            ))}
            {showNextAction && (
              <th
                className="sticky right-0 z-10 border-l border-border-soft bg-card px-3.5 py-2.5 font-medium"
                style={{ right: showRowActions ? rowActionsColWidth : 0, width: nextActionColWidth }}
              >
                Next Action
              </th>
            )}
            {showRowActions && (
              <th className="sticky right-0 z-10 border-l border-border-soft bg-card px-2 py-2.5" style={{ width: rowActionsColWidth }} />
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const fullName = `${row.lead.first_name} ${row.lead.last_name}`;
            return (
              <tr
                key={row.lead.id}
                className="group border-b border-border-soft transition-colors hover:bg-surface"
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <InitialsAvatar name={fullName} size="sm" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/advisor/investors/${row.lead.id}`}
                          className="font-semibold text-foreground hover:text-primary"
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
                <td className="px-3.5 py-2.5">
                  <StageBadge stage={row.lead.current_stage} className="rounded-control" />
                </td>
                <td className="px-3.5 py-2.5 text-secondary-foreground">
                  {row.advisor ? `${row.advisor.first_name} ${row.advisor.last_name}` : "—"}
                </td>
                <td className="px-3.5 py-2.5 text-secondary-foreground">
                  {labelForValue(row.questionnaire?.liquid_capital ?? row.lead.initial_liquid_capital)}
                </td>
                <td className="px-3.5 py-2.5">
                  {row.video ? (
                    <MiniVideoRing percent={row.video.highest_percent_watched} completed={row.video.completed} />
                  ) : (
                    <span className="text-secondary-foreground">—</span>
                  )}
                </td>
                <td className="px-3.5 py-2.5 text-muted-foreground">{formatRelative(row.lastActivityAt)}</td>
                {showNextAction && (
                  <td
                    className="sticky right-0 z-10 border-l border-border-soft bg-card px-3.5 py-2.5 group-hover:bg-surface"
                    style={{ right: showRowActions ? rowActionsColWidth : 0, width: nextActionColWidth }}
                  >
                    <NextActionPill action={row.nextAction} />
                  </td>
                )}
                {showRowActions && (
                  <td
                    className="sticky right-0 z-10 border-l border-border-soft bg-card px-2 py-2.5 text-right group-hover:bg-surface"
                    style={{ width: rowActionsColWidth }}
                  >
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
