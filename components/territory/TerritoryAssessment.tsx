"use client";

import { Card } from "@/components/ui/card";
import { buildTerritoryAssessment } from "@/lib/territory/briefing";
import type { TerritoryEvaluationResult } from "@/types/territory";

/**
 * The "Territory Assessment" briefing: an investment-memo style narrative
 * composed deterministically from established facts (see
 * lib/territory/briefing.ts — no LLM, no invented figures).
 */
export function TerritoryAssessment({ result }: { result: TerritoryEvaluationResult }) {
  const paragraphs = buildTerritoryAssessment(result);
  if (paragraphs.length === 0) return null;

  return (
    <Card className="ti-fade-up p-5 transition-shadow duration-200 hover:shadow-md" style={{ animationDelay: "80ms" }}>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-faint-foreground">
        Territory Assessment
      </p>
      <div className="mt-2.5 space-y-2.5">
        {paragraphs.map((paragraph, index) => (
          <p
            key={index}
            className={
              index === paragraphs.length - 1
                ? "text-[11.5px] leading-relaxed text-muted-foreground"
                : "text-[13px] leading-relaxed text-secondary-foreground"
            }
          >
            {paragraph}
          </p>
        ))}
      </div>
    </Card>
  );
}
