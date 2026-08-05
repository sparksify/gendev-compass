"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buildWhyThisMarket } from "@/lib/territory/briefing";
import { cn } from "@/lib/utils";
import type { TerritoryEvaluationResult } from "@/types/territory";

/**
 * Collapsible "Why this market?" panel — shifts the conversation from
 * "can I buy here?" to "why should I want to?". Content is deterministic
 * (lib/territory/briefing.ts): real demand data when loaded, brand-fit
 * positioning, and honest caveats.
 */
export function WhyThisMarket({ result }: { result: TerritoryEvaluationResult }) {
  const [open, setOpen] = useState(false);
  const sections = buildWhyThisMarket(result);
  if (sections.length === 0) return null;

  return (
    <Card className="ti-fade-up transition-shadow duration-200 hover:shadow-md" style={{ animationDelay: "160ms" }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="text-[13.5px] font-bold text-foreground">Why this market?</span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          strokeWidth={2}
        />
      </button>
      {open && (
        <div className="space-y-4 border-t border-border-soft px-5 py-4">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-faint-foreground">
                {section.title}
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {section.points.map((point, index) => (
                  <li key={index} className="flex gap-2 text-[12.5px] leading-relaxed text-secondary-foreground">
                    <span className="mt-[7px] size-1 shrink-0 rounded-full bg-primary" aria-hidden />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
