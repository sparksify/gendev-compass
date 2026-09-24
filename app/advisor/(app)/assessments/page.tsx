import { PageTitle, V3Page } from "@/components/advisor/v3";
import { FitAssessmentsList } from "@/components/advisor/questionnaires/FitAssessmentsList";
import { requireStaffUser } from "@/lib/advisor/auth";
import { loadInvestorRows } from "@/lib/advisor/investors";

export const dynamic = "force-dynamic";

export const metadata = { title: "Fit Assessments" };

/**
 * Everyone who finished the bridge page's 2-minute fit assessment, newest
 * first. These are the seven quick answers a prospect gives before entering
 * the portal — the earliest real signal of intent — so they get their own
 * queue, separate from the qualification questionnaires.
 */
export default async function AssessmentsPage() {
  const user = await requireStaffUser();
  const rows = (await loadInvestorRows(user))
    .filter((row) => row.assessment !== null)
    .sort((a, b) => (b.assessment?.submittedAt ?? "").localeCompare(a.assessment?.submittedAt ?? ""))
    .map((row) => ({ lead: row.lead, assessment: row.assessment! }));

  return (
    <V3Page>
      <PageTitle
        title="Assessments"
        meta={`${rows.length} submitted on the bridge page · newest first`}
      />
      <FitAssessmentsList rows={rows} />
    </V3Page>
  );
}
