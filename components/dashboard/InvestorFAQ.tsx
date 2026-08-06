import * as AccordionPrimitive from "@radix-ui/react-accordion";
import {
  ClipboardList,
  GraduationCap,
  Plus,
  Repeat,
  Shield,
  ShieldCheck,
  ShieldQuestion,
  Star,
  User,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdvisorContact } from "@/components/cards/AdvisorContact";
import { brand } from "@/lib/config/brand";
import { getAdvisorPhotoUrl } from "@/lib/assets";
import { FAQ_CATEGORIES, FAQ_ITEMS, type FaqIconKey } from "@/lib/config/content";

const FAQ_ICONS: Record<FaqIconKey, typeof ShieldCheck> = {
  "shield-check": ShieldCheck,
  repeat: Repeat,
  users: Users,
  "clipboard-list": ClipboardList,
  user: User,
  shield: Shield,
  "graduation-cap": GraduationCap,
  star: Star,
};

/**
 * "Investor Questions" — two-column FAQ presentation shared by the
 * dedicated /faq page and the homepage FAQ section. Left rail introduces
 * the topic and offers a direct line to the advisor; right column groups
 * questions into labeled categories with a compact "+" accordion.
 */
export async function InvestorFAQ({ token }: { token: string }) {
  const advisorPhotoUrl = await getAdvisorPhotoUrl();
  const base = `/p/${token}`;

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr]">
        <div className="border-b border-border bg-surface px-6 py-7 sm:px-8 lg:border-b-0 lg:border-r">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-accent-gold">
            Investor Resources
          </p>
          <h2 className="mt-1.5 font-serif text-[26px] font-medium leading-[1.1] text-sidebar">
            Investor Questions
          </h2>
          <span className="mt-3 block h-[2.5px] w-10 bg-accent-gold" aria-hidden />
          <p className="mt-3.5 text-[13px] leading-[1.6] text-muted-foreground">
            Answers to the questions investors ask most often while evaluating this opportunity.
          </p>

          <div className="mt-6 rounded-card border border-border bg-card p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded asset */}
            <img
              src={advisorPhotoUrl ?? brand.advisorPhotoPath}
              alt={`${brand.advisorName}, your advisor`}
              className="size-11 shrink-0 rounded-full object-cover"
            />
            <p className="mt-3 text-[13px] font-semibold text-foreground">
              Still have a question?
            </p>
            <AdvisorContact
              token={token}
              phone={brand.advisorPhone}
              email={brand.advisorEmail}
              className="mt-2.5 flex flex-col gap-1.5"
            />
            <Button
              asChild
              className="mt-4 w-full bg-sidebar text-[13px] hover:bg-sidebar/90"
            >
              <a href={`mailto:${brand.advisorEmail}`}>Ask {brand.advisorName}</a>
            </Button>
          </div>
        </div>

        <div className="px-6 py-7 sm:px-8">
          {FAQ_CATEGORIES.map((category) => {
            const items = FAQ_ITEMS.filter((item) => item.category === category.key);
            if (items.length === 0) return null;
            return (
              <div key={category.key} className="mb-7 last:mb-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent-gold">
                  {category.label}
                </p>
                <div className="mt-2 border-t border-border" />
                <AccordionPrimitive.Root type="single" collapsible className="mt-1">
                  {items.map((item, index) => {
                    const Icon = FAQ_ICONS[item.icon] ?? ShieldQuestion;
                    return (
                      <AccordionPrimitive.Item
                        key={item.question}
                        value={`${category.key}-${index}`}
                        className="border-b border-border last:border-b-0"
                      >
                        <AccordionPrimitive.Header>
                          <AccordionPrimitive.Trigger className="group flex w-full items-center gap-3 py-3.5 text-left [&[data-state=open]_svg.faq-plus]:rotate-45">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-[6px] border border-accent-gold/40 bg-[#fbf7ef] text-sidebar">
                              <Icon className="size-[14px]" strokeWidth={1.6} />
                            </span>
                            <span className="flex-1 text-[13.5px] text-secondary-foreground">
                              {item.question}
                            </span>
                            <Plus
                              className="faq-plus size-4 shrink-0 text-accent-gold transition-transform duration-200"
                              strokeWidth={2}
                            />
                          </AccordionPrimitive.Trigger>
                        </AccordionPrimitive.Header>
                        <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:hidden">
                          <p className="max-w-[600px] pb-4 pl-10 text-[13px] leading-[1.6] text-muted-foreground">
                            {item.answer}
                          </p>
                        </AccordionPrimitive.Content>
                      </AccordionPrimitive.Item>
                    );
                  })}
                </AccordionPrimitive.Root>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface px-6 py-3.5 sm:px-8">
        <p className="flex items-center gap-2 text-[12px] leading-[1.5] text-muted-foreground">
          <Shield className="size-[13px] shrink-0 text-faint-foreground" strokeWidth={1.8} />
          All information is preliminary. Final territory availability must be confirmed by
          GenDev and the franchisor.
        </p>
        <a
          href={`${base}/territory-advisor`}
          className="whitespace-nowrap text-[12px] font-medium text-sidebar hover:text-sidebar/80"
        >
          View our Territory Process →
        </a>
      </div>
    </Card>
  );
}
