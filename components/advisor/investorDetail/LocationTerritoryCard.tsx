import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { UsRegionMap } from "./UsRegionMap";
import { Disclosure } from "./Disclosure";
import { regionForState } from "@/lib/advisor/regions";
import { stateName } from "@/lib/geocoding/states";
import type { QuestionnaireRecord } from "@/types/questionnaire";
import type { LeadRecord } from "@/types/lead";

export function LocationTerritoryCard({
  lead,
  questionnaire,
  isAdminUser,
}: {
  lead: LeadRecord;
  questionnaire: QuestionnaireRecord | null;
  isAdminUser: boolean;
}) {
  const stateToken = questionnaire?.state ?? lead.state;
  const region = regionForState(stateToken);
  // Prefer the specific city/state the candidate gave us; fall back to the
  // broader Census region, then a polished empty state — never a blank map.
  const primaryMarket =
    questionnaire?.city && questionnaire.state
      ? `${questionnaire.city}, ${questionnaire.state}`
      : (region ?? (stateToken ? stateName(stateToken) : null));

  return (
    <Card className="h-full rounded-2xl">
      <CardContent className="p-6">
        <p className="text-sm font-semibold text-foreground">Location & Territory</p>

        <UsRegionMap region={region} className="mt-3 rounded-control bg-surface" />

        <div className="mt-3">
          <p className="text-[11px] text-muted-foreground">Primary Market</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">{primaryMarket ?? "Not provided"}</p>
        </div>

        {isAdminUser && (
          <Link
            href="/advisor/territories"
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View Territory Insights
            <ArrowRight className="size-3" />
          </Link>
        )}

        {(questionnaire?.address_line_1 || questionnaire?.city || questionnaire?.postal_code) && (
          <Disclosure summary="Full address" className="mt-3 border-t border-border-soft pt-3">
            <div className="space-y-0.5 text-xs text-muted-foreground">
              {questionnaire.address_line_1 && (
                <p>{[questionnaire.address_line_1, questionnaire.address_line_2].filter(Boolean).join(", ")}</p>
              )}
              <p>
                {[questionnaire.city, questionnaire.state, questionnaire.postal_code].filter(Boolean).join(", ")}
              </p>
              {questionnaire.country && <p>{questionnaire.country}</p>}
            </div>
          </Disclosure>
        )}
      </CardContent>
    </Card>
  );
}
