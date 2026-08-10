"use client";

import { useMemo, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildOwnershipIntelligenceReport } from "@/data/ownershipProfileInsights";
import {
  growthComfortLabel,
  motivationLabels,
  ownershipStyleLabel,
  priorityLabels,
  timelineLabel,
  type OwnershipProfileInput,
} from "@/types/ownershipProfile";
import {
  DueDiligenceQuestions,
  DueDiligenceTopics,
  NextResearchStepCard,
  ProfileInsightsNarrative,
} from "@/components/portal/ownership-profile/ReportSections";
import { ResponsesAccordion } from "@/components/portal/ownership-profile/ResponsesAccordion";
import { ReportActions } from "@/components/portal/ownership-profile/ReportActions";

interface ProfileSummaryProps {
  profile: OwnershipProfileInput;
  isSaved: boolean;
  onSave: () => void;
  onEdit: () => void;
  /** Scopes saved due-diligence questions and builds CTA links. */
  token: string;
  /** The franchise brand under evaluation, from portal context (nullable). */
  brandName: string | null;
}

/**
 * The Ownership Profile's closing screen — an ownership intelligence
 * report. Interprets the responses (deterministically — see
 * data/ownershipProfileInsights.ts) into due-diligence guidance rather
 * than repeating them; the raw answers move to a collapsed section.
 * Still never a score, fit verdict, or recommendation.
 */
export function ProfileSummary({
  profile,
  isSaved,
  onSave,
  onEdit,
  token,
  brandName,
}: ProfileSummaryProps) {
  const [justSaved, setJustSaved] = useState(false);

  const handleSave = () => {
    onSave();
    setJustSaved(true);
  };

  const report = useMemo(() => buildOwnershipIntelligenceReport(profile), [profile]);

  const styleLabel = ownershipStyleLabel(profile.ownershipStyle);
  const growth = growthComfortLabel(profile) ?? "Not yet specified";
  const timeline = timelineLabel(profile) ?? "Not yet specified";

  const headline = [
    { label: "Primary Goals", value: motivationLabels(profile).slice(0, 2).join(" · ") || "—" },
    { label: "Preferred Ownership Style", value: styleLabel },
    {
      label: "Ideal Business Characteristics",
      value: priorityLabels(profile).slice(0, 3).join(" · ") || "—",
    },
    { label: "Growth Ambition", value: growth },
    { label: "Timeline", value: timeline },
  ];

  return (
    <div>
      <div className="flex flex-col items-center text-center">
        <span
          className="ownership-profile-celebrate flex size-14 items-center justify-center rounded-full bg-success-soft text-success"
          aria-hidden
        >
          <Sparkles className="size-6" strokeWidth={1.8} />
        </span>
        <p className="mt-4 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-accent-gold">
          Profile Complete
        </p>
        <h2 className="mt-1.5 font-serif text-[28px] font-normal leading-[1.15] text-foreground sm:text-[32px]">
          Your Ownership Profile
        </h2>
        <p className="mt-3 max-w-[34rem] text-[13.5px] leading-[1.65] text-muted-foreground">
          This profile will help personalize your GenDev Compass experience and assist your
          advisor in focusing on the topics most relevant to your goals.
        </p>
      </div>

      <Card className="mt-8 border-primary-soft-border bg-primary-soft/30">
        <CardContent className="p-6 sm:p-8">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            {headline.map((entry) => (
              <div key={entry.label}>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  {entry.label}
                </dt>
                <dd className="mt-1 text-[14.5px] font-bold leading-snug text-foreground">
                  {entry.value}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="mt-10 space-y-10">
        <ProfileInsightsNarrative paragraphs={report.narrative} />
        <DueDiligenceTopics topics={report.topics} brandName={brandName} />
        <DueDiligenceQuestions questions={report.questions} token={token} />
        {report.nextStep && <NextResearchStepCard step={report.nextStep} token={token} />}
        <ResponsesAccordion profile={profile} />
        <ReportActions />
      </div>

      <div className="mt-9 flex flex-col items-center gap-3 border-t border-border-soft pt-8">
        <Button
          type="button"
          size="lg"
          onClick={handleSave}
          disabled={isSaved}
          className="w-full sm:w-auto"
        >
          {isSaved ? (
            <>
              <Check className="size-4" strokeWidth={2.2} />
              Saved to Your Investor Portal
            </>
          ) : (
            "Save to My Investor Portal"
          )}
        </Button>
        <button
          type="button"
          onClick={onEdit}
          className="text-[12.5px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          Edit my responses
        </button>
        {isSaved && justSaved && (
          <p className="text-[12px] text-muted-foreground">
            Saved on this device. You can return anytime to review or update your profile.
          </p>
        )}
      </div>
    </div>
  );
}
