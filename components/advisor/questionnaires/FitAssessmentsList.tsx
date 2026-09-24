import { GridHead, NameCell, Panel, StackCell } from "@/components/advisor/v3";
import { formatDate, formatRelative } from "@/lib/advisor/format";
import { leadSourceMeta } from "@/lib/config/leadSources";
import { cn } from "@/lib/utils";
import { answerFor, type BridgeAssessmentRecord } from "@/lib/bridge/assessmentRecord";
import type { LeadRecord } from "@/types/lead";

export interface FitAssessmentRow {
  lead: LeadRecord;
  assessment: BridgeAssessmentRecord;
}

const COLS = "1.4fr .8fr .7fr 1.1fr .9fr .95fr 1fr";

/**
 * Every submitted bridge-page fit assessment, newest first. These are not
 * qualification questionnaires (those live in the list above): they are the
 * seven quick answers a prospect gave before entering the portal, so they
 * get their own queue rather than being mixed into the questionnaire count.
 */
export function FitAssessmentsList({ rows }: { rows: FitAssessmentRow[] }) {
  return (
    <section className="flex flex-col gap-3.5">
      <Panel padded={false} className="overflow-x-auto px-[18px] pb-2.5 pt-1.5">
        <div className="min-w-[980px]">
          <GridHead columns={COLS}>
            <span>Prospect</span>
            <span>Submitted</span>
            <span>Fit</span>
            <span>Goal</span>
            <span>Timeline</span>
            <span>Liquid Capital</span>
            <span>Where</span>
          </GridHead>

          {rows.length === 0 && (
            <p className="py-10 text-center text-[13.5px] text-muted-foreground">
              No fit assessments yet — prospects appear here the moment they finish the bridge page.
            </p>
          )}

          {rows.map(({ lead, assessment }, index) => {
            const strong = assessment.fit === "strong";
            const source = leadSourceMeta(lead.source);
            return (
              <div
                key={lead.id}
                className={cn(
                  "grid items-center gap-x-3.5 py-2.5 transition-colors hover:bg-surface-raised",
                  index < rows.length - 1 && "border-b border-border-soft",
                )}
                style={{ gridTemplateColumns: COLS }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <NameCell
                    href={`/advisor/investors/${lead.id}#fit-assessment`}
                    name={`${lead.first_name} ${lead.last_name}`}
                    sub={lead.email}
                  />
                  {source && (
                    <span
                      title={source.label}
                      className={cn(
                        "inline-flex shrink-0 rounded-[6px] border px-1.5 py-0.5 text-[10.5px] font-bold tracking-[0.03em]",
                        source.badgeClass,
                      )}
                    >
                      {source.shortCode}
                    </span>
                  )}
                </span>

                <StackCell
                  value={formatDate(assessment.submittedAt)}
                  sub={formatRelative(assessment.submittedAt)}
                />

                <span
                  className={cn(
                    "inline-flex w-fit items-center gap-1.5 rounded-pill px-[11px] py-[3px] text-[11.5px] font-bold",
                    strong ? "bg-success-soft text-success" : "bg-surface text-secondary-foreground",
                  )}
                >
                  {strong ? "Strong" : "Standard"}
                </span>

                <Cell value={answerFor(assessment, "goal")} />
                <Cell value={answerFor(assessment, "timeline")} />
                <Cell value={answerFor(assessment, "liquidCapital")} />
                <Cell value={answerFor(assessment, "location")} />
              </div>
            );
          })}
        </div>
      </Panel>
    </section>
  );
}

function Cell({ value }: { value: string | null }) {
  return value ? (
    <span className="truncate text-[12.5px] font-semibold text-foreground" title={value}>
      {value}
    </span>
  ) : (
    <span className="text-[12.5px] text-ghost-foreground">—</span>
  );
}
