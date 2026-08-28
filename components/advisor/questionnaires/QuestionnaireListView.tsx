import { Download } from "lucide-react";
import { GridHead, NameCell, Panel, StackCell } from "@/components/advisor/v3";
import { SECONDARY_BUTTON_SM } from "@/components/advisor/controls";
import { BulkSelectCheckbox } from "@/components/advisor/BulkSelect";
import { formatDate, formatRelative } from "@/lib/advisor/format";
import { labelForValue, labelIn } from "@/lib/advisor/questionnaireCatalog";
import { cn } from "@/lib/utils";
import { CREDIT_SCORE_RANGES, FINANCING_NEED_OPTIONS } from "@/types/questionnaire";
import type { InvestorRow } from "@/lib/advisor/investors";
import { Answer, submittedAtFor, verdictFor } from "./shared";

/** Table columns, per the handoff's grid ratios. */
const COLS = "1.4fr .75fr 1.05fr .95fr .8fr .7fr 1.05fr 84px";

/**
 * Every completed questionnaire, newest first — the advisor's reading queue,
 * styled to match the clients list: a card table with a bold name over the
 * email, and a dotted pill for the qualification verdict and its score.
 */
export function QuestionnaireListView({ rows }: { rows: InvestorRow[] }) {
  return (
    <Panel padded={false} className="overflow-x-auto px-[18px] pb-2.5 pt-1.5">
      <div className="min-w-[1040px]">
        <GridHead columns={COLS}>
          <span>Investor</span>
          <span>Submitted</span>
          <span>Qualification</span>
          <span>Liquid Capital</span>
          <span>Timeline</span>
          <span>Credit Range</span>
          <span>Financing</span>
          <span className="text-right">Report</span>
        </GridHead>

        {rows.length === 0 && (
          <p className="py-10 text-center text-[13.5px] text-muted-foreground">
            No completed questionnaires yet — investors appear here the moment they submit.
          </p>
        )}

        {rows.map((row, index) => {
          const submittedAt = submittedAtFor(row);
          const verdict = verdictFor(row);
          return (
            <div
              key={row.lead.id}
              className={cn(
                "grid items-center gap-x-3.5 py-2.5 transition-colors hover:bg-surface-raised",
                index < rows.length - 1 && "border-b border-border-soft",
              )}
              style={{ gridTemplateColumns: COLS }}
            >
              <span className="flex min-w-0 items-center gap-[7px]">
                <BulkSelectCheckbox id={row.lead.id} />
                <NameCell
                  href={`/advisor/investors/${row.lead.id}#questionnaire-responses`}
                  name={`${row.lead.first_name} ${row.lead.last_name}`}
                  sub={row.lead.email}
                />
              </span>

              {submittedAt ? (
                <StackCell value={formatDate(submittedAt)} sub={formatRelative(submittedAt)} />
              ) : (
                <span className="text-[12.5px] text-ghost-foreground">—</span>
              )}

              <span className="min-w-0">
                {row.lead.qualification_result ? (
                  <span
                    className="inline-flex max-w-full items-center gap-1.5 rounded-pill px-[11px] py-[3px] text-[11.5px] font-bold"
                    style={{ color: verdict.color, backgroundColor: verdict.tint }}
                  >
                    <span
                      aria-hidden
                      className="size-[5px] shrink-0 rounded-full"
                      style={{ backgroundColor: verdict.color }}
                    />
                    <span className="truncate">
                      {verdict.label}
                      {typeof row.lead.qualification_score === "number"
                        ? ` · ${row.lead.qualification_score}`
                        : ""}
                    </span>
                  </span>
                ) : (
                  <span className="text-[12.5px] text-ghost-foreground">—</span>
                )}
              </span>

              <span className="tabular truncate text-[13px] font-bold text-foreground">
                {labelForValue(row.questionnaire?.liquid_capital)}
              </span>

              <Answer value={labelForValue(row.questionnaire?.investment_timeline)} />
              <Answer
                className="tabular"
                value={labelIn(CREDIT_SCORE_RANGES, row.questionnaire?.estimated_credit_score_range)}
              />
              <Answer value={labelIn(FINANCING_NEED_OPTIONS, row.questionnaire?.financing_need)} />

              <span className="flex justify-end">
                <a
                  href={`/api/advisor/investors/${row.lead.id}/questionnaire-pdf`}
                  download
                  className={SECONDARY_BUTTON_SM}
                  aria-label={`Download ${row.lead.first_name} ${row.lead.last_name}'s questionnaire PDF`}
                >
                  <Download className="size-[11px]" strokeWidth={2} />
                  PDF
                </a>
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
