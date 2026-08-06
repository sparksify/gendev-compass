import { Mail, Phone } from "lucide-react";
import { LIQUID_CAPITAL_RANGES, NET_WORTH_RANGES } from "@/types/questionnaire";
import type { LeadRecord } from "@/types/lead";

function labelFor(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string | null,
) {
  if (!value) return null;
  return options.find((option) => option.value === value)?.label ?? value;
}

/**
 * A premium profile summary — what's already on file, presented like a
 * confirmation rather than a data table, so the questionnaire feels like
 * a continuation of one application instead of a fresh, anonymous form.
 */
export function InvestorProfileSummary({ lead }: { lead: LeadRecord }) {
  const liquidCapital = labelFor(LIQUID_CAPITAL_RANGES, lead.initial_liquid_capital);
  const netWorth = labelFor(NET_WORTH_RANGES, lead.initial_net_worth);
  const businessOwnership =
    lead.initial_business_owner !== null ? (lead.initial_business_owner ? "Yes" : "No") : null;

  const stats = [
    liquidCapital && { label: "Liquid Capital", value: liquidCapital },
    netWorth && { label: "Net Worth", value: netWorth },
    businessOwnership && { label: "Business Ownership", value: businessOwnership },
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry));

  return (
    <section aria-label="Application summary">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
        Application Summary
      </p>
      <h2 className="mt-1.5 font-serif text-[26px] font-normal leading-tight text-foreground">
        {lead.first_name} {lead.last_name}
      </h2>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Mail className="size-3.5 shrink-0 text-faint-foreground" strokeWidth={1.8} />
          {lead.email}
        </span>
        {lead.phone && (
          <span className="inline-flex items-center gap-1.5">
            <Phone className="size-3.5 shrink-0 text-faint-foreground" strokeWidth={1.8} />
            {lead.phone}
          </span>
        )}
      </div>

      {stats.length > 0 && (
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border-soft pt-5 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                {stat.label}
              </dt>
              <dd className="mt-1 text-[14.5px] font-bold text-foreground">{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <p className="mt-5 text-[12px] leading-relaxed text-muted-foreground">
        On file from your application — your advisor reviews this alongside your answers below.
      </p>
    </section>
  );
}
