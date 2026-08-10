"use client";

import { ArrowRight, BookmarkCheck, BookmarkPlus, Compass } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSavedDueDiligenceQuestions } from "@/hooks/useSavedDueDiligenceQuestions";
import type {
  DueDiligenceQuestion,
  DueDiligenceTopic,
  NextResearchStep,
} from "@/data/ownershipProfileInsights";

/** Shared section heading for the intelligence-report blocks. */
function ReportSectionHeader({ title, supporting }: { title: string; supporting?: string }) {
  return (
    <div>
      <h3 className="font-serif text-[21px] font-normal leading-[1.2] text-foreground sm:text-[23px]">
        {title}
      </h3>
      <span className="mt-2.5 block h-[2.5px] w-10 bg-accent-gold" aria-hidden />
      {supporting && (
        <p className="mt-3 max-w-[36rem] text-[13px] leading-[1.65] text-muted-foreground">
          {supporting}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// What Your Profile Suggests
// ---------------------------------------------------------------------------

export function ProfileInsightsNarrative({ paragraphs }: { paragraphs: string[] }) {
  if (paragraphs.length === 0) return null;
  return (
    <section>
      <ReportSectionHeader title="What Your Profile Suggests" />
      <div className="mt-4 space-y-3.5">
        {paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-[13.5px] leading-[1.75] text-foreground/85">
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// How to Evaluate This Opportunity Through Your Priorities
// ---------------------------------------------------------------------------

export function DueDiligenceTopics({
  topics,
  brandName,
}: {
  topics: DueDiligenceTopic[];
  brandName: string | null;
}) {
  if (topics.length === 0) return null;
  return (
    <section>
      <ReportSectionHeader
        title={`How to Evaluate ${brandName ?? "This Opportunity"} Through Your Priorities`}
        supporting="Based on what you told us matters most, these are areas worth exploring more closely during your due diligence."
      />
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {topics.map((topic) => (
          <Card key={topic.id}>
            <CardContent className="p-5 sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-gold">
                {topic.title}
              </p>
              <p className="mt-2.5 text-[13px] leading-[1.7] text-foreground/85">{topic.guidance}</p>
              {topic.suggestedQuestions && topic.suggestedQuestions.length > 0 && (
                <ul className="mt-3.5 space-y-1.5 border-t border-border-soft pt-3.5">
                  {topic.suggestedQuestions.map((question) => (
                    <li
                      key={question}
                      className="flex items-start gap-2 text-[12.5px] leading-relaxed text-muted-foreground"
                    >
                      <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-accent-gold" />
                      {question}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Questions Selected for You
// ---------------------------------------------------------------------------

export function DueDiligenceQuestions({
  questions,
  token,
}: {
  questions: DueDiligenceQuestion[];
  token: string;
}) {
  const { saved, toggle } = useSavedDueDiligenceQuestions(token);
  if (questions.length === 0) return null;
  return (
    <section>
      <ReportSectionHeader
        title="Questions Selected for You"
        supporting="Based on your Ownership Profile, these questions may be especially useful during your advisor, franchisor, and franchisee conversations."
      />
      <ol className="mt-5 space-y-2.5">
        {questions.map((question, index) => {
          const isSaved = saved.includes(question.id);
          return (
            <li
              key={question.id}
              className="flex items-start gap-3.5 rounded-control border border-border bg-card px-4 py-3.5"
            >
              <span
                aria-hidden
                className="flex size-[22px] shrink-0 items-center justify-center rounded-[5px] border border-border-strong text-[11.5px] font-bold text-[#475467]"
              >
                {index + 1}
              </span>
              <span className="flex-1 pt-px text-[13.5px] leading-[1.6] text-foreground">
                {question.text}
              </span>
              <button
                type="button"
                onClick={() => toggle(question.id)}
                aria-pressed={isSaved}
                className={
                  isSaved
                    ? "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-[11.5px] font-semibold text-success transition-colors"
                    : "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                }
              >
                {isSaved ? (
                  <>
                    <BookmarkCheck className="size-3.5" strokeWidth={2} />
                    <span className="hidden sm:inline">Added</span>
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="size-3.5" strokeWidth={2} />
                    <span className="hidden sm:inline">Add to My Due Diligence</span>
                    <span className="sm:hidden">Add</span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Your Next Research Step
// ---------------------------------------------------------------------------

export function NextResearchStepCard({
  step,
  token,
}: {
  step: NextResearchStep;
  token: string;
}) {
  return (
    <section>
      <ReportSectionHeader title="Your Next Research Step" />
      <Card className="mt-5 border-primary-soft-border bg-primary-soft/40">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-start gap-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-primary">
              <Compass className="size-4.5" strokeWidth={1.8} />
            </span>
            <div>
              <h4 className="text-[14.5px] font-bold text-foreground">{step.title}</h4>
              <p className="mt-1.5 max-w-[34rem] text-[13px] leading-[1.65] text-muted-foreground">
                {step.rationale}
              </p>
            </div>
          </div>
          {step.ctaLabel && step.ctaPath && (
            <Button asChild className="shrink-0">
              <Link href={`/p/${token}${step.ctaPath}`}>
                {step.ctaLabel}
                <ArrowRight className="size-4" strokeWidth={1.8} />
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
