import Link from "next/link";
import { ArrowRight, Info, Leaf, MapPin, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { regionForState } from "@/lib/advisor/regions";
import type { LeadRecord } from "@/types/lead";
import type { QuestionnaireRecord } from "@/types/questionnaire";

function Field({ label, value, link }: { label: string; value: string | null; link?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10.5px] text-faint-foreground">{label}</p>
      {value ? (
        link ? (
          <a href={link} className="block truncate text-[12.5px] font-semibold text-primary hover:underline">
            {value}
          </a>
        ) : (
          <p className="truncate text-[12.5px] font-medium text-foreground">{value}</p>
        )
      ) : (
        <p className="text-[12.5px] text-[#c2c9d4]">—</p>
      )}
    </div>
  );
}

/**
 * How the lead reached us — broker referral (with the broker's contact
 * details) or organic (with first-touch channel data). Replaces the old
 * Location & Territory card; the territory line lives in the footer.
 */
export function LeadSourceCard({
  lead,
  questionnaire,
}: {
  lead: LeadRecord;
  questionnaire: QuestionnaireRecord | null;
}) {
  const isBroker = (lead.lead_type ?? "organic") === "broker";
  const stateToken = questionnaire?.state ?? lead.state;
  const territory =
    questionnaire?.city && questionnaire.state
      ? `${questionnaire.city}, ${questionnaire.state}`
      : (regionForState(stateToken) ?? "Not provided");

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col px-[15px] py-[13px]">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1 text-[15px] font-bold text-foreground">
            Lead source
            <Info className="size-[13px] text-[#c2c9d4]" aria-label="How this lead reached us" />
          </p>
          {isBroker ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#d8c9f2] bg-[#f6f2ff] px-2 py-0.5 text-[11px] font-semibold text-[#6d28d9]">
              <Users className="size-[11px]" />
              Broker
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#cfebd8] bg-[#f2faf5] px-2 py-0.5 text-[11px] font-semibold text-[#15803d]">
              <Leaf className="size-[11px]" />
              Organic
            </span>
          )}
        </div>

        <div className="mt-[9px] grid flex-1 grid-cols-[repeat(auto-fit,minmax(130px,1fr))] content-start gap-x-4 gap-y-2">
          {isBroker ? (
            <>
              <Field label="Broker" value={lead.broker_name ?? null} />
              <Field label="Franchise network" value={lead.broker_network ?? null} />
              <Field
                label="Email"
                value={lead.broker_email ?? null}
                link={lead.broker_email ? `mailto:${lead.broker_email}` : undefined}
              />
              <Field
                label="Phone"
                value={lead.broker_phone ?? null}
                link={lead.broker_phone ? `tel:${lead.broker_phone}` : undefined}
              />
            </>
          ) : (
            <>
              <Field label="Channel" value={lead.source ?? lead.first_utm_source} />
              <Field label="Campaign" value={lead.campaign ?? lead.first_utm_campaign} />
              <Field label="Medium" value={lead.first_utm_medium} />
              <Field label="Landing page" value={lead.first_landing_page} />
            </>
          )}
        </div>
        {!isBroker && (
          <a
            href="#attribution"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Full attribution
            <ArrowRight className="size-3" />
          </a>
        )}

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-border-soft pt-[9px]">
          <p className="flex items-center gap-1.5 text-[12.5px] text-secondary-foreground">
            <MapPin className="size-3.5 text-faint-foreground" />
            Territory
            <span className="font-semibold text-foreground">{territory}</span>
          </p>
          <Link
            href="/advisor/territories"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Territory insights
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
