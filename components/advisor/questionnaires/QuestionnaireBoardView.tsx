import { AlertCircle, CalendarCheck, CalendarClock, ClipboardCheck, Download } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Panel } from "@/components/advisor/v3";
import { SECONDARY_BUTTON_SM } from "@/components/advisor/controls";
import { BulkSelectCheckbox } from "@/components/advisor/BulkSelect";
import { SIGNAL } from "@/lib/advisor/discoveryStages";
import { formatRelative } from "@/lib/advisor/format";
import { labelForValue } from "@/lib/advisor/questionnaireCatalog";
import { cn } from "@/lib/utils";
import type { InvestorRow } from "@/lib/advisor/investors";
import { submittedAtFor, type TriageStage, triageStageFor } from "./shared";

interface Column {
  stage: TriageStage;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  tint: string;
}

const COLUMNS: Column[] = [
  {
    stage: "needs_review",
    title: "Needs Review",
    description: "Didn't clear automatic qualification",
    icon: AlertCircle,
    color: SIGNAL.warning,
    tint: SIGNAL.warningTint,
  },
  {
    stage: "ready_to_schedule",
    title: "Ready to Schedule",
    description: "Qualified, no consultation booked yet",
    icon: ClipboardCheck,
    color: SIGNAL.neutral,
    tint: SIGNAL.neutralTint,
  },
  {
    stage: "scheduled",
    title: "Consultation Scheduled",
    description: "On the calendar",
    icon: CalendarClock,
    color: SIGNAL.accentInk,
    tint: "#fff6d9",
  },
  {
    stage: "completed",
    title: "Consultation Completed",
    description: "Already talked to the investor",
    icon: CalendarCheck,
    color: SIGNAL.success,
    tint: SIGNAL.successTint,
  },
];

/**
 * The same completed-questionnaire queue as the List view, regrouped into a
 * read-only triage board: where is each investor in the path from "just
 * submitted" to "we've talked"? Cards never move themselves — this is a
 * different lens on the same data, not a pipeline you drag leads through.
 */
export function QuestionnaireBoardView({ rows }: { rows: InvestorRow[] }) {
  const byStage = new Map<TriageStage, InvestorRow[]>();
  for (const row of rows) {
    const stage = triageStageFor(row);
    const list = byStage.get(stage) ?? [];
    list.push(row);
    byStage.set(stage, list);
  }

  return (
    <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((column) => {
        const columnRows = byStage.get(column.stage) ?? [];
        const Icon = column.icon;
        return (
          <div key={column.stage} className="flex min-w-0 flex-col gap-2.5">
            <div className="flex items-center gap-2 px-0.5">
              <span
                aria-hidden
                className="flex size-6 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: column.tint, color: column.color }}
              >
                <Icon className="size-3.5" strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="flex items-baseline gap-1.5">
                  <span className="truncate text-[13px] font-extrabold text-foreground">
                    {column.title}
                  </span>
                  <span className="tabular text-[12px] font-bold text-muted-foreground">
                    {columnRows.length}
                  </span>
                </span>
                <span className="block truncate text-[11px] font-medium text-faint-foreground">
                  {column.description}
                </span>
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {columnRows.length === 0 && (
                <Panel className="py-6 text-center text-[12px] text-ghost-foreground">
                  None right now
                </Panel>
              )}
              {columnRows.map((row) => (
                <QuestionnaireCard key={row.lead.id} row={row} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QuestionnaireCard({ row }: { row: InvestorRow }) {
  const submittedAt = submittedAtFor(row);
  const name = `${row.lead.first_name} ${row.lead.last_name}`;

  return (
    <Panel className="flex flex-col gap-2 px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-start gap-[7px]">
          <BulkSelectCheckbox id={row.lead.id} />
          <a
            href={`/advisor/investors/${row.lead.id}#questionnaire-responses`}
            className="min-w-0"
          >
            <span className="block truncate text-[13px] font-bold text-foreground hover:underline">
              {name}
            </span>
            <span className="block truncate text-[11.5px] font-medium text-faint-foreground">
              {row.lead.email}
            </span>
          </a>
        </span>
        {typeof row.lead.qualification_score === "number" && (
          <span className="tabular shrink-0 text-[11px] font-bold text-muted-foreground">
            {row.lead.qualification_score}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
        <span className="font-semibold">
          {labelForValue(row.questionnaire?.liquid_capital)}
        </span>
        <span className="truncate">
          {labelForValue(row.questionnaire?.investment_timeline)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span
          className={cn(
            "truncate text-[11px] font-medium",
            submittedAt ? "text-faint-foreground" : "text-ghost-foreground",
          )}
        >
          {submittedAt ? `Submitted ${formatRelative(submittedAt)}` : "Not submitted"}
        </span>
        <a
          href={`/api/advisor/investors/${row.lead.id}/questionnaire-pdf`}
          download
          className={cn(SECONDARY_BUTTON_SM, "shrink-0")}
          aria-label={`Download ${name}'s questionnaire PDF`}
        >
          <Download className="size-[10px]" strokeWidth={2} />
        </a>
      </div>
    </Panel>
  );
}
