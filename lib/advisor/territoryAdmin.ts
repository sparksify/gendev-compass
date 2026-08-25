import { getStore } from "@/lib/store";

/**
 * Review requests still waiting on a human — the count the Review Queue tab
 * carries as an amber badge. "Waiting" is anything that hasn't reached a
 * decision (approved / declined / closed).
 */
export async function countPendingTerritoryReviews(): Promise<number> {
  try {
    const reviews = await getStore().listTerritoryReviewRequests();
    return reviews.filter((review) => review.status === "new" || review.status === "in_review")
      .length;
  } catch (error) {
    console.error("[advisor] pending review count failed:", error);
    return 0;
  }
}
