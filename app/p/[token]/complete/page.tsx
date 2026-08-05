import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Legacy route. The consultation page (/schedule) now carries both the
 * scheduling calendar and, once booked, the confirmation state — there is
 * no longer a passive holding page after the questionnaire.
 */
export default async function CompletePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/p/${token}/schedule`);
}
