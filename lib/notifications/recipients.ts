import { getStore } from "@/lib/store";
import { getDefaultAdvisorNotificationEmail } from "@/lib/config/env";
import type { LeadRecord } from "@/types/lead";

/**
 * Who hears about an investor's activity.
 *
 * The recipient is always derived server-side from the investor's own
 * record or from configuration — never from request input. An investor
 * cannot influence where their notification goes.
 */

export interface ResolvedRecipient {
  email: string;
  name: string | null;
  source: "assigned_advisor" | "default";
}

/**
 * Prefers the advisor actually assigned to the investor, falling back to the
 * configured default inbox. Returns null when neither exists, which the
 * caller records as a failed delivery rather than silently dropping.
 */
export async function resolveAdvisorRecipient(lead: LeadRecord): Promise<ResolvedRecipient | null> {
  if (lead.assigned_advisor_id) {
    try {
      const advisor = await getStore().getStaffUserById(lead.assigned_advisor_id);
      // A deactivated advisor still owns the record but should not be paged;
      // the default inbox picks those up.
      if (advisor?.active && advisor.email) {
        return {
          email: advisor.email,
          name: `${advisor.first_name} ${advisor.last_name}`.trim() || null,
          source: "assigned_advisor",
        };
      }
    } catch (error) {
      // Fall through to the default rather than losing the notification.
      console.error(`[notifications] advisor lookup failed for lead ${lead.id}:`, error);
    }
  }

  const fallback = getDefaultAdvisorNotificationEmail();
  if (fallback) {
    return { email: fallback, name: null, source: "default" };
  }

  return null;
}
