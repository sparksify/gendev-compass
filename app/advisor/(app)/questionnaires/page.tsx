import Link from "next/link";
import { Download } from "lucide-react";
import { PageBody, PageHeader } from "@/components/advisor/PageHeader";
import { SECONDARY_BUTTON_SM } from "@/components/advisor/controls";
import {
  BulkSelectBar,
  BulkSelectCheckbox,
  BulkSelectProvider,
} from "@/components/advisor/BulkSelect";
import { requireStaffUser } from "@/lib/advisor/auth";
import { isAdmin } from "@/lib/advisor/access";
import { loadInvestorRows } from "@/lib/advisor/investors";
import { formatDate, formatRelative } from "@/lib/advisor/format";
import { labelForValue, labelIn } from "@/lib/advisor/questionnaireCatalog";
import { SIGNAL } from "@/lib/advisor/discoveryStages";
import { cn } from "@/lib/utils";
import { CREDIT_SCORE_RANGES, FINANCING_NEED_OPTIONS } from "@/types/questionnaire";

export const dynamic = "force-dynamic";

export const metadata = { title: "Completed Questionnaires" };

/** Table columns — same flat grid the clients list uses. */
const GRID = "grid-cols-[2fr_1.3fr_1.5fr_1.2fr_1.2fr_1.1fr_1.2fr_1fr]";

/**
 * Every completed questionnaire, newest first — the advisor's reading
 * queue, styled to match the clients list: flat grid table, bold name with
 * the email beneath, chips for the qualification verdict. Each row links
 * into the full responses on the client card; PDF downloads the formatted
 * report. Admins can bulk-select rows to clear them from the queue.
 */
export default async function QuestionnairesPage() {
  const user = await requireStaffUser();
  const admin = isAdmin(user);
  const rows = (await loadInvestorRows(user))
    .filter((row) => row.questionnaire !== null)
    .sort((a, b) => {
      const aAt = a.lead.questionnaire_completed_at ?? a.questionnaire?.created_at ?? "";
      const bAt = b.lead.questionnaire_completed_at ?? b.questionnaire?.created_at ?? "";
      return bAt.localeCompare(aAt);
    });

  return (
    <BulkSelectProvider
      endpoint="/api/advisor/questionnaires/bulk-delete"
      noun="questionnaire"
      allIds={admin ? rows.map((row) => row.lead.id) : []}
    >
      <PageHeader
        title="Questionnaires"
        subtitle={`${rows.length} completed · newest first`}
        actions={admin ? <BulkSelectBar /> : undefined}
      />
      <PageBody className="flex flex-col gap-[18px]">
        <div className="overflow-x-auto">
          <div className="min-w-[1040px]">
            <div
              className={cn(
                "grid gap-x-4 border-b border-border py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-faint-foreground",
                GRID,
              )}
            >
              <span>Investor</span>
              <span>Submitted</span>
              <span>Qualification</span>
              <span>Liquid capital</span>
              <span>Timeline</span>
              <span>Credit range</span>
              <span>Financing</span>
              <span className="text-right">Report</span>
            </div>

            {rows.length === 0 && (
              <p className="py-10 text-center text-[14.5px] text-muted-foreground">
                No completed questionnaires yet — investors appear here the moment they submit.
              </p>
            )}

            {rows.map((row) => {
              const fullName = `${row.lead.first_name} ${row.lead.last_name}`;
              const submittedAt =
                row.lead.questionnaire_completed_at ?? row.questionnaire?.created_at ?? null;
              const qualified = row.lead.qualification_result === "qualified";
              return (
                <div
                  key={row.lead.id}
                  className={cn(
                    "grid items-center gap-x-4 border-b border-border-soft py-[13px] text-[14.5px] transition-colors hover:bg-surface-raised",
                    GRID,
                  )}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-[7px] font-bold text-foreground">
                      <BulkSelectCheckbox id={row.lead.id} />
                      <Link
                        href={`/advisor/investors/${row.lead.id}#questionnaire-responses`}
                        className="truncate hover:underline"
                      >
                        {fullName}
                      </Link>
                    </span>
                    <span className="block truncate text-[12.5px] text-faint-foreground">
                      {row.lead.email}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="tabular block truncate text-[13.5px] leading-[1.45] text-secondary-foreground">
                      {submittedAt ? formatDate(submittedAt) : "—"}
                    </span>
                    {submittedAt && (
                      <span className="tabular block truncate text-[12px] text-ghost-foreground">
                        {formatRelative(submittedAt)}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    {row.lead.qualification_result ? (
                      <span
                        className="inline-flex max-w-full items-center gap-1.5 rounded-full px-[11px] py-1 text-[12.5px] font-bold"
                        style={
                          qualified
                            ? { color: SIGNAL.success, backgroundColor: SIGNAL.successTint }
                            : { color: SIGNAL.warning, backgroundColor: SIGNAL.warningTint }
                        }
                      >
                        <span
                          aria-hidden
                          className="size-[5px] shrink-0 rounded-full"
                          style={{
                            backgroundColor: qualified ? SIGNAL.success : SIGNAL.warning,
                          }}
                        />
                        <span className="truncate">
                          {qualified ? "Qualified" : "Review required"}
                          {typeof row.lead.qualification_score === "number"
                            ? ` · ${row.lead.qualification_score}`
                            : ""}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[13.5px] text-ghost-foreground">—</span>
                    )}
                  </span>
                  <span className="tabular truncate text-secondary-foreground">
                    {labelForValue(row.questionnaire?.liquid_capital)}
                  </span>
                  <span className="truncate text-[13.5px] text-secondary-foreground">
                    {labelForValue(row.questionnaire?.investment_timeline)}
                  </span>
                  <span className="tabular truncate text-[13.5px] text-secondary-foreground">
                    {labelIn(CREDIT_SCORE_RANGES, row.questionnaire?.estimated_credit_score_range)}
                  </span>
                  <span className="truncate text-[13.5px] text-secondary-foreground">
                    {labelIn(FINANCING_NEED_OPTIONS, row.questionnaire?.financing_need)}
                  </span>
                  <span className="flex justify-end">
                    <a
                      href={`/api/advisor/investors/${row.lead.id}/questionnaire-pdf`}
                      download
                      className={SECONDARY_BUTTON_SM}
                    >
                      <Download className="size-3.5" strokeWidth={2} />
                      PDF
                    </a>
                  </span>
                </div>
              );
            })}

            {rows.length > 0 && (
              <p className="pt-3.5 text-[13px] text-faint-foreground">
                Showing {rows.length} of {rows.length}
              </p>
            )}
          </div>
        </div>
      </PageBody>
    </BulkSelectProvider>
  );
}
