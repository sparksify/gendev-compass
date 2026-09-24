import { PageTitle, V3Page } from "@/components/advisor/v3";
import { BulkSelectBar, BulkSelectProvider } from "@/components/advisor/BulkSelect";
import { QuestionnairesViewSwitcher } from "@/components/advisor/questionnaires/QuestionnairesViewSwitcher";
import { requireStaffUser } from "@/lib/advisor/auth";
import { isAdmin } from "@/lib/advisor/access";
import { loadInvestorRows } from "@/lib/advisor/investors";
import { getStore } from "@/lib/store";
import { assessmentFromEvent } from "@/lib/bridge/assessmentRecord";
import { FitAssessmentsList, type FitAssessmentRow } from "@/components/advisor/questionnaires/FitAssessmentsList";

export const dynamic = "force-dynamic";

export const metadata = { title: "Completed Questionnaires" };

/**
 * Every completed questionnaire, newest first — the advisor's reading queue.
 * Two lenses on the same rows: a List (sortable, dense, good for scanning
 * many at once) and a Board (grouped by where each investor sits between
 * "just submitted" and "we've talked"). Admins can bulk-select rows in
 * either view to clear them from the queue.
 */
export default async function QuestionnairesPage() {
  const user = await requireStaffUser();
  const admin = isAdmin(user);
  const allRows = await loadInvestorRows(user);
  const rows = allRows
    .filter((row) => row.questionnaire !== null)
    .sort((a, b) => {
      const aAt = a.lead.questionnaire_completed_at ?? a.questionnaire?.created_at ?? "";
      const bAt = b.lead.questionnaire_completed_at ?? b.questionnaire?.created_at ?? "";
      return bAt.localeCompare(aAt);
    });

  // Bridge-page fit assessments: one row per lead (latest submission), only
  // for leads this staff user is allowed to see.
  const leadById = new Map(allRows.map((row) => [row.lead.id, row.lead]));
  const assessmentEvents = await getStore()
    .listEventsByName("bridge_assessment_submitted")
    .catch(() => []);
  const seen = new Set<string>();
  const assessments: FitAssessmentRow[] = [];
  for (const event of assessmentEvents) {
    const lead = leadById.get(event.lead_id);
    if (!lead || seen.has(lead.id)) continue;
    const assessment = assessmentFromEvent(event);
    if (!assessment) continue;
    seen.add(lead.id);
    assessments.push({ lead, assessment });
  }

  return (
    <BulkSelectProvider
      endpoint="/api/advisor/questionnaires/bulk-delete"
      noun="questionnaire"
      allIds={admin ? rows.map((row) => row.lead.id) : []}
    >
      <V3Page>
        <PageTitle
          title="Questionnaires"
          meta={`${rows.length} completed · newest first`}
          actions={admin ? <BulkSelectBar /> : undefined}
        />

        <QuestionnairesViewSwitcher rows={rows} />

        {rows.length > 0 && (
          <p className="text-[12.5px] font-semibold text-muted-foreground">
            Showing {rows.length} of {rows.length} questionnaires
          </p>
        )}

        <FitAssessmentsList rows={assessments} />
      </V3Page>
    </BulkSelectProvider>
  );
}
