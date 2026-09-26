import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { loadPortalContext } from "@/lib/portal/context";

export const dynamic = "force-dynamic";

export default async function QualificationReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = await loadPortalContext(token);
  if (!context) return <InvalidPortal />;
  const { lead, state } = context;
  if (state.qualified || state.booked) redirect(`/p/${token}/schedule`);

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-accent-gold">Next step</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-sidebar">Let’s learn a little more about your goals</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">Thanks, {lead.first_name}. We have your responses. Before opening a private conversation, we want to make sure the opportunity and your goals are aligned.</p>
      </div>
      <Card><CardContent className="space-y-4 p-6 sm:p-8">
        <h2 className="font-serif text-2xl text-sidebar">Explore your options</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">This is not a permanent rejection. Review the opportunity at your own pace, and revisit your profile if your situation or goals change.</p>
        <a href={`/p/${token}/questionnaire`} className="inline-flex min-h-11 items-center justify-center rounded-md bg-sidebar px-5 text-sm font-semibold text-white hover:bg-sidebar/90">Complete the detailed profile</a>
      </CardContent></Card>
    </div>
  );
}
