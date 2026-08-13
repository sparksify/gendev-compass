import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { UsRegionMap } from "./UsRegionMap";
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

  return (
    <Card className="h-full">
      <CardContent className="p-5">
        <p className="text-sm font-semibold text-foreground">Location & Territory</p>

        <UsRegionMap region={region} className="mt-3 rounded-control bg-surface" />

        <div className="mt-3">
          <p className="text-[11px] text-muted-foreground">Primary Territory</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {region ?? (stateToken ? stateName(stateToken) : "Not provided")}
          </p>
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
          <details className="mt-3 border-t border-border-soft pt-3">
            <summary className="cursor-pointer text-xs font-medium text-primary hover:underline">
              Full address
            </summary>
            <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {questionnaire.address_line_1 && (
                <p>{[questionnaire.address_line_1, questionnaire.address_line_2].filter(Boolean).join(", ")}</p>
              )}
              <p>
                {[questionnaire.city, questionnaire.state, questionnaire.postal_code].filter(Boolean).join(", ")}
              </p>
              {questionnaire.country && <p>{questionnaire.country}</p>}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
