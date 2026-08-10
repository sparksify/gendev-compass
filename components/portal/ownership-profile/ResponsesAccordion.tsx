"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  activityLabels,
  environmentLabels,
  experienceLabels,
  motivationLabels,
  priorityLabels,
  type OwnershipProfileInput,
} from "@/types/ownershipProfile";

interface ResponseGroup {
  title: string;
  items: string[];
}

/**
 * The raw answer chips, demoted from prime position to a collapsed
 * secondary section — the interpretation is now the star, but the investor
 * can always review exactly what they selected.
 */
export function ResponsesAccordion({ profile }: { profile: OwnershipProfileInput }) {
  const groups: ResponseGroup[] = [
    { title: "Your Goals", items: motivationLabels(profile) },
    { title: "What You Enjoy", items: activityLabels(profile) },
    { title: "Your Ideal Operating Environment", items: environmentLabels(profile) },
    { title: "Business Characteristics You Value", items: priorityLabels(profile) },
    { title: "Your Background", items: experienceLabels(profile) },
  ].filter((group) => group.items.length > 0);

  if (groups.length === 0) return null;

  return (
    <section>
      <Accordion type="single" collapsible>
        <AccordionItem value="responses" className="border-border-soft bg-surface/50">
          <AccordionTrigger className="px-4 py-3.5 text-[13px] font-semibold text-foreground">
            Your Responses — view everything you selected
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 pl-4">
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 pt-1 sm:grid-cols-2">
              {groups.map((group) => (
                <div key={group.title}>
                  <h4 className="text-[12px] font-bold text-foreground">{group.title}</h4>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {group.items.map((item) => (
                      <li
                        key={item}
                        className="rounded-full border border-border-soft bg-card px-2.5 py-1 text-[12px] font-medium text-foreground"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
