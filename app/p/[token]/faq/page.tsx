import { Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { InvalidPortal } from "@/components/portal/InvalidPortal";
import { loadPortalContext } from "@/lib/portal/context";
import { trackEvent } from "@/lib/portal/events";
import { FAQ_ITEMS } from "@/lib/config/content";

export const dynamic = "force-dynamic";

/**
 * Investor FAQ as its own page — previously an anchor-scroll section on
 * the home dashboard (kept there too), now a real destination so the
 * sidebar link is a normal navigation instead of a same-page jump.
 */
export default async function FaqPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await loadPortalContext(token);
  if (!context) return <InvalidPortal />;

  await trackEvent(context.lead, "faq_opened", null, "faq");

  return (
    <div className="space-y-[18px]">
      <div>
        <h1 className="font-serif text-[32px] font-normal leading-[1.1] tracking-[-0.01em] text-foreground sm:text-[38px]">
          Investor FAQ
        </h1>
        <p className="mt-2.5 max-w-[38rem] text-[13.5px] leading-[1.65] text-muted-foreground">
          Answers to the questions investors ask most often while evaluating this opportunity.
        </p>
      </div>

      <Card className="pb-4">
        <Accordion type="single" collapsible className="flex flex-col gap-2 px-5 pt-[18px]">
          {FAQ_ITEMS.map((item, index) => (
            <AccordionItem key={index} value={`faq-${index}`}>
              <AccordionTrigger>
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-5 shrink-0 items-center justify-center rounded border border-primary-soft-border bg-[#f2f6ff] text-primary"
                  >
                    <Play className="size-[11px] fill-current" strokeWidth={0} />
                  </span>
                  {item.question}
                </span>
              </AccordionTrigger>
              <AccordionContent>{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
    </div>
  );
}
