import { NextResponse } from "next/server";
import { authorizedCron } from "@/lib/config/cron";
import { getStore } from "@/lib/store";
import { retryMetaCapiDelivery } from "@/lib/tracking/dispatch";

export const dynamic = "force-dynamic";

/**
 * Bounded-retry worker for failed Meta CAPI deliveries (spec §19):
 * +5m, +30m, +2h, then stop. Scheduled every few minutes in vercel.json;
 * safe to invoke more often since listDueTrackingDeliveries only returns
 * deliveries whose next_attempt_at has passed.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (!authorizedCron(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const store = getStore();
  const due = await store.listDueTrackingDeliveries(new Date().toISOString());

  let retried = 0;
  for (const delivery of due) {
    try {
      await retryMetaCapiDelivery(delivery);
      retried += 1;
    } catch (error) {
      console.error(`[tracking-retry] retry failed for delivery ${delivery.id}:`, error);
    }
  }

  return NextResponse.json({ success: true, dueCount: due.length, retried });
}
