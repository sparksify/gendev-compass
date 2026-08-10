"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Closing action area: keep-a-copy CTA plus the educational disclaimer.
 *
 * V1 download uses the browser's print → save-as-PDF flow. TODO(pdf): a
 * dedicated PDF layer should eventually render investor name, completion
 * date, the summary, research areas, questions, next steps, and the
 * disclaimer as a standalone document — without printing the portal
 * chrome. Deliberately not built here to avoid a heavy dependency.
 */
export function ReportActions() {
  return (
    <section>
      <Card>
        <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-gold">
              Your Ownership Intelligence Report
            </p>
            <p className="mt-2 max-w-[34rem] text-[13px] leading-[1.65] text-muted-foreground">
              Keep a copy of your profile and use it as a reference throughout your franchise due
              diligence process.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            onClick={() => window.print()}
          >
            <Download className="size-4" strokeWidth={1.8} />
            Download My Profile
          </Button>
        </CardContent>
      </Card>

      <p className="mt-5 text-center text-[11.5px] leading-[1.7] text-faint-foreground">
        Your Ownership Profile is an educational tool designed to help organize your franchise
        research and due diligence. It does not constitute legal, financial, investment, or
        business advice, and it should not be interpreted as a recommendation to purchase any
        franchise opportunity.
      </p>
    </section>
  );
}
