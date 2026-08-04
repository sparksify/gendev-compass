import { Play } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
    <Card id="faq">
      <CardContent className="space-y-3">
        <SectionHeader number={4} title="Frequently Asked Questions" />
        <Accordion type="single" collapsible>
          {FAQ_ITEMS.map((item, index) => (
            <AccordionItem key={index} value={`faq-${index}`}>
              <AccordionTrigger>
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary"
                  >
                    <Play className="size-2.5 fill-current" />
                  </span>
                  {item.question}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pl-9">{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
