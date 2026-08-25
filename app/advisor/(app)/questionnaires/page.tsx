import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageBody, PageHeader } from "@/components/advisor/PageHeader";
import { Button } from "@/components/ui/button";
import { InitialsAvatar } from "@/components/advisor/investorDetail/InitialsAvatar";
import { requireStaffUser } from "@/lib/advisor/auth";
import { loadInvestorRows } from "@/lib/advisor/investors";
import { formatDateTime } from "@/lib/advisor/format";
import { labelForValue, labelIn } from "@/lib/advisor/questionnaireCatalog";
import { CREDIT_SCORE_RANGES, FINANCING_NEED_OPTIONS } from "@/types/questionnaire";

export const dynamic = "force-dynamic";

export const metadata = { title: "Completed Questionnaires" };

/**
 * Every completed questionnaire, newest first — the advisor's reading
 * queue. A lead appears here the moment their submission lands; each row
 * links to the full responses on the client card and downloads the
 * formatted PDF report.
 */
export default async function QuestionnairesPage() {
  const user = await requireStaffUser();
  const rows = (await loadInvestorRows(user))
    .filter((row) => row.questionnaire !== null)
    .sort((a, b) => {
      const aAt = a.lead.questionnaire_completed_at ?? a.questionnaire?.created_at ?? "";
      const bAt = b.lead.questionnaire_completed_at ?? b.questionnaire?.created_at ?? "";
      return bAt.localeCompare(aAt);
    });

  return (
    <>
      <PageHeader
        title="Questionnaires"
        subtitle="Every investor who has finished qualification, newest first"
      />
      <PageBody>
        <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No completed questionnaires yet — investors appear here the moment they submit.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-faint-foreground">
                    <th className="px-4 py-2.5 font-medium">Investor</th>
                    <th className="px-3.5 py-2.5 font-medium">Submitted</th>
                    <th className="px-3.5 py-2.5 font-medium">Qualification</th>
                    <th className="px-3.5 py-2.5 font-medium">Liquid Capital</th>
                    <th className="px-3.5 py-2.5 font-medium">Timeline</th>
                    <th className="px-3.5 py-2.5 font-medium">Credit Range</th>
                    <th className="px-3.5 py-2.5 font-medium">Financing</th>
                    <th className="px-3.5 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const fullName = `${row.lead.first_name} ${row.lead.last_name}`;
                    const submittedAt =
                      row.lead.questionnaire_completed_at ?? row.questionnaire?.created_at ?? null;
                    const qualified = row.lead.qualification_result === "qualified";
                    return (
                      <tr
                        key={row.lead.id}
                        className="border-b border-border-soft transition-colors hover:bg-surface"
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <InitialsAvatar name={fullName} size="sm" />
                            <div className="min-w-0">
                              <Link
                                href={`/advisor/investors/${row.lead.id}#questionnaire-responses`}
                                className="font-semibold text-foreground hover:text-primary"
                              >
                                {fullName}
                              </Link>
                              <p className="truncate text-xs text-muted-foreground">
                                {row.lead.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-secondary-foreground">
                          {formatDateTime(submittedAt)}
                        </td>
                        <td className="px-3.5 py-2.5">
                          {row.lead.qualification_result ? (
                            <span
                              className={
                                qualified
                                  ? "inline-flex rounded-full bg-[#e8f6ec] px-2 py-0.5 text-[11px] font-semibold text-[#15803d]"
                                  : "inline-flex rounded-full bg-[#fff4e5] px-2 py-0.5 text-[11px] font-semibold text-[#b45309]"
                              }
                            >
                              {qualified
                                ? "Qualified"
                                : "Review required"}
                              {typeof row.lead.qualification_score === "number"
                                ? ` · ${row.lead.qualification_score}`
                                : ""}
                            </span>
                          ) : (
                            <span className="text-secondary-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-secondary-foreground">
                          {labelForValue(row.questionnaire?.liquid_capital)}
                        </td>
                        <td className="px-3.5 py-2.5 text-secondary-foreground">
                          {labelForValue(row.questionnaire?.investment_timeline)}
                        </td>
                        <td className="px-3.5 py-2.5 text-secondary-foreground">
                          {labelIn(
                            CREDIT_SCORE_RANGES,
                            row.questionnaire?.estimated_credit_score_range,
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-secondary-foreground">
                          {labelIn(FINANCING_NEED_OPTIONS, row.questionnaire?.financing_need)}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button asChild variant="ghost" size="sm">
                              <Link
                                href={`/advisor/investors/${row.lead.id}#questionnaire-responses`}
                              >
                                <FileText className="size-3.5" />
                                View
                              </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm">
                              <a
                                href={`/api/advisor/investors/${row.lead.id}/questionnaire-pdf`}
                                download
                              >
                                <Download className="size-3.5" />
                                PDF
                              </a>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
