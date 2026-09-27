import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { loadPortalContext } from "@/lib/portal/context";
import { bridgeCapitalBand } from "@/lib/config/qualification";
import { LIQUID_CAPITAL_OPTIONS } from "@/lib/bridge/assessment";
import { trackEvent } from "@/lib/portal/events";

export const dynamic = "force-dynamic";

export default async function FinancialEducationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await loadPortalContext(token);
  if (!context) return <InvalidPortal />;
  await trackEvent(context.lead, "financial_education_opened", null, `/p/${token}/financial-education`);

  const capitalBand = bridgeCapitalBand(context.lead.initial_liquid_capital);
  const capitalLabel = LIQUID_CAPITAL_OPTIONS.find((option) => option.value === context.lead.initial_liquid_capital)?.label ?? "Not provided";

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-accent-gold">Your next step</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-foreground sm:text-[42px]">Thanks, {context.lead.first_name} — let’s make the path clear</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          CMDT currently requires prospective franchise owners to have at least $50,000 in qualifying liquid capital. Based on your current response, you may not yet meet that requirement. That does not mean you have to stop learning.
        </p>
      </div>

      <section className="rounded-card border border-border bg-card p-6 shadow-card sm:p-8">
        <h2 className="font-serif text-2xl text-sidebar">Where you are now</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md bg-surface p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your response</p><p className="mt-2 text-lg font-semibold text-foreground">{capitalLabel}</p></div>
          <div className="rounded-md bg-surface p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">CMDT starting point</p><p className="mt-2 text-lg font-semibold text-foreground">$50,000 qualifying liquid capital</p></div>
        </div>
        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
          {capitalBand === "under-25k"
            ? "Your current response is below the stated starting point. The exact amount you would need depends on your actual available resources and the investment plan you ultimately choose."
            : "Your current response is below the stated starting point, but you may have additional resources that were not included in the first answer. A future review can look at the complete picture."}
        </p>
      </section>

      <section className="rounded-card border border-border bg-card p-6 shadow-card sm:p-8">
        <h2 className="font-serif text-2xl text-sidebar">Ways people may prepare</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Depending on your circumstances, people commonly explore a combination of:</p>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <li><strong className="text-foreground">Personal or household savings:</strong> resources already available for a business investment.</li>
          <li><strong className="text-foreground">A business partner:</strong> sharing the investment and ownership responsibilities with someone you trust.</li>
          <li><strong className="text-foreground">Financing:</strong> speaking with a qualified lender about what you may be able to borrow and what cash contribution would still be required.</li>
          <li><strong className="text-foreground">Other assets:</strong> asking a qualified advisor whether retirement assets, home equity, or another resource may be relevant to your situation.</li>
        </ul>
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">These are general educational examples, not a financing recommendation or a promise of approval. A lender or qualified financial professional must determine what may be available to you.</p>
      </section>

      <section className="rounded-card border border-primary-soft-border bg-primary-soft/40 p-6 sm:p-8">
        <h2 className="font-serif text-2xl text-sidebar">Keep learning about CMDT</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Explore the business model, customer base, owner responsibilities, and available resources at your own pace. If your financial situation changes, you can return and revisit the qualification process.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={`/p/${token}/opportunity`} className="inline-flex min-h-11 items-center justify-center rounded-md bg-sidebar px-6 text-sm font-semibold text-white hover:bg-sidebar/90">Learn more about CMDT</a>
          <a href={`/p/${token}/faq`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-sidebar/40 px-6 text-sm font-semibold text-sidebar hover:bg-surface">Review common questions</a>
        </div>
      </section>
    </div>
  );
}
