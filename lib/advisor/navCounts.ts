import { loadInvestorRows } from "@/lib/advisor/investors";
import type { AdvisorNavCounts } from "@/components/advisor/AdvisorShell";
import type { StaffUserRecord } from "@/types/advisor";

const WEEK_MS = 7 * 24 * 3_600_000;

/**
 * The two numbers the sidebar carries: how many clients this staff member can
 * see, and how many questionnaires landed in the last week (the unread pile).
 * Both come straight from the rows the rest of the advisor app already reads —
 * no separate counters to drift out of sync.
 */
export async function loadNavCounts(
  user: StaffUserRecord,
  now: Date = new Date(),
): Promise<AdvisorNavCounts> {
  try {
    const rows = await loadInvestorRows(user);
    const cutoff = now.getTime() - WEEK_MS;
    return {
      clients: rows.length,
      questionnaires: rows.filter((row) => {
        const at = row.lead.questionnaire_completed_at;
        return Boolean(at) && new Date(at as string).getTime() >= cutoff;
      }).length,
    };
  } catch (error) {
    // The rail must never take the page down with it.
    console.error("[advisor] nav counts failed:", error);
    return { clients: 0, questionnaires: 0 };
  }
}
