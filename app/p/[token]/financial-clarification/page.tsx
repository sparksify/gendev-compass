import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { FinancialClarificationForm } from "@/components/portal/FinancialClarificationForm";
import { loadPortalContext } from "@/lib/portal/context";

export const dynamic = "force-dynamic";

export default async function FinancialClarificationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await loadPortalContext(token);
  if (!context) return <InvalidPortal />;

  return (
    <main className="min-h-screen bg-surface px-4 py-10 text-foreground sm:px-6 sm:py-16">
      <div className="mx-auto max-w-[760px]">
        <p className="text-center text-sm font-semibold uppercase tracking-[0.12em] text-accent-gold">One more step</p>
        <h1 className="mt-3 text-center font-serif text-4xl leading-tight text-sidebar sm:text-[46px]">Let’s clarify your situation</h1>
        <p className="mx-auto mt-4 max-w-[620px] text-center text-base leading-relaxed text-muted-foreground">
          Thanks, {context.lead.first_name}. A few quick questions will help us understand whether you may already have access to the resources needed for the CMDT opportunity.
        </p>
        <div className="mt-8 rounded-card border border-border bg-card p-6 shadow-card sm:p-9">
          <FinancialClarificationForm token={token} initialCapital={context.lead.initial_liquid_capital} />
        </div>
      </div>
    </main>
  );
}
