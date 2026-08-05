import { LIQUID_CAPITAL_RANGES, NET_WORTH_RANGES } from "@/types/questionnaire";
import type { LeadRecord } from "@/types/lead";

function labelFor(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string | null,
): string | null {
  if (!value) return null;
  return options.find((option) => option.value === value)?.label ?? value;
}

/**
 * The prospect's information on file, shown above the questionnaire so the
 * page reads as one continuous application rather than a cold form.
 */
export function InvestorProfileSummary({ lead }: { lead: LeadRecord }) {
  const entries: { label: string; value: string }[] = [
    { label: "Name", value: `${lead.first_name} ${lead.last_name}`.trim() },
    { label: "Email", value: lead.email },
  ];
  if (lead.phone) entries.push({ label: "Phone", value: lead.phone });

  const liquidCapital = labelFor(LIQUID_CAPITAL_RANGES, lead.initial_liquid_capital);
  if (liquidCapital) entries.push({ label: "Liquid capital (from application)", value: liquidCapital });

  const netWorth = labelFor(NET_WORTH_RANGES, lead.initial_net_worth);
  if (netWorth) entries.push({ label: "Net worth (from application)", value: netWorth });

  if (lead.initial_business_owner !== null) {
    entries.push({
      label: "Owned a business",
      value: lead.initial_business_owner ? "Yes" : "No",
    });
  }

  return (
    <section aria-label="Your information on file">
      <h2 className="text-[15.5px] font-bold text-foreground">Your Information</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        On file from your application. Your advisor reviews this alongside your answers below.
      </p>

      <dl className="mt-4 grid gap-x-6 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => (
          <div key={entry.label}>
            <dt className="text-[12.5px] text-muted-foreground">{entry.label}</dt>
            <dd className="mt-0.5 text-[13.5px] font-medium text-foreground">{entry.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
