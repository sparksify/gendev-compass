import { Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ_ITEMS } from "@/lib/config/content";

export function FAQAccordion() {
  return (
    <Card id="faq" className="pb-4">
      <div className="px-5 pb-3.5 pt-[18px]">
        <SectionHeader number={3} title="Frequently Asked Questions" />
      </div>
      <Accordion type="single" collapsible className="flex flex-col gap-2 px-5">
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
  );
}
