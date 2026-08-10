"use client";

import { useMemo } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useOwnershipProfileStorage } from "@/hooks/useOwnershipProfileStorage";
import { MultiSelectStep } from "@/components/portal/ownership-profile/MultiSelectStep";
import { SingleSelectStep } from "@/components/portal/ownership-profile/SingleSelectStep";
import { OwnershipStyleStep } from "@/components/portal/ownership-profile/OwnershipStyleStep";
import { ProfileSummary } from "@/components/portal/ownership-profile/ProfileSummary";
import {
  ACTIVITY_OPTIONS,
  ACTIVITY_SELECTION_LIMIT,
  ENVIRONMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  GROWTH_COMFORT_OPTIONS,
  MOTIVATION_OPTIONS,
  PRIORITY_OPTIONS,
  PRIORITY_SELECTION_LIMIT,
  TIMELINE_OPTIONS,
  countAnsweredSections,
  OWNERSHIP_PROFILE_SECTION_COUNT,
  type ActivityValue,
  type EnvironmentValue,
  type ExperienceValue,
  type GrowthComfortValue,
  type MotivationValue,
  type OwnershipProfileInput,
  type PriorityValue,
  type TimelineValue,
} from "@/types/ownershipProfile";

interface StepDefinition {
  title: string;
  render: (profile: OwnershipProfileInput, updateProfile: (patch: Partial<OwnershipProfileInput>) => void) => React.ReactNode;
}

const STEPS: StepDefinition[] = [
  {
    title: "Motivation",
    render: (profile, updateProfile) => (
      <MultiSelectStep
        prompt="What motivated you to begin exploring business ownership?"
        helper="Select every reason that resonates with you."
        options={MOTIVATION_OPTIONS}
        selected={profile.motivations}
        onChange={(values) => updateProfile({ motivations: values as MotivationValue[] })}
        columns={2}
      />
    ),
  },
  {
    title: "Preferred Activities",
    render: (profile, updateProfile) => (
      <MultiSelectStep
        prompt="Which business activities sound most enjoyable?"
        options={ACTIVITY_OPTIONS}
        selected={profile.activities}
        onChange={(values) => updateProfile({ activities: values as ActivityValue[] })}
        max={ACTIVITY_SELECTION_LIMIT}
        columns={2}
      />
    ),
  },
  {
    title: "Ownership Style",
    render: (profile, updateProfile) => (
      <OwnershipStyleStep
        value={profile.ownershipStyle}
        onChange={(value) => updateProfile({ ownershipStyle: value })}
      />
    ),
  },
  {
    title: "Growth Comfort",
    render: (profile, updateProfile) => (
      <SingleSelectStep
        prompt="How comfortable are you with growth?"
        options={GROWTH_COMFORT_OPTIONS}
        value={profile.growthComfort}
        onChange={(value) => updateProfile({ growthComfort: value as GrowthComfortValue })}
        columns={2}
      />
    ),
  },
  {
    title: "Business Environment",
    render: (profile, updateProfile) => (
      <MultiSelectStep
        prompt="Which business environments interest you?"
        helper="Select every industry you'd consider."
        options={ENVIRONMENT_OPTIONS}
        selected={profile.environments}
        onChange={(values) => updateProfile({ environments: values as EnvironmentValue[] })}
        columns={3}
      />
    ),
  },
  {
    title: "Decision Priorities",
    render: (profile, updateProfile) => (
      <MultiSelectStep
        prompt="What matters most as you evaluate a business?"
        options={PRIORITY_OPTIONS}
        selected={profile.priorities}
        onChange={(values) => updateProfile({ priorities: values as PriorityValue[] })}
        max={PRIORITY_SELECTION_LIMIT}
        columns={2}
      />
    ),
  },
  {
    title: "Previous Experience",
    render: (profile, updateProfile) => (
      <MultiSelectStep
        prompt="What's your previous professional experience?"
        helper="Select everything that applies."
        options={EXPERIENCE_OPTIONS}
        selected={profile.experience}
        onChange={(values) => updateProfile({ experience: values as ExperienceValue[] })}
        columns={2}
      />
    ),
  },
  {
    title: "Timeline",
    render: (profile, updateProfile) => (
      <SingleSelectStep
        prompt="What's your current timeline?"
        options={TIMELINE_OPTIONS}
        value={profile.timeline}
        onChange={(value) => updateProfile({ timeline: value as TimelineValue })}
        columns={2}
      />
    ),
  },
];

interface OwnershipProfileAssessmentProps {
  /** Scopes local persistence to this investor's portal link. */
  token: string;
  /** The brand under evaluation, from portal context (null if unresolved). */
  brandName: string | null;
}

export function OwnershipProfileAssessment({ token, brandName }: OwnershipProfileAssessmentProps) {
  const { profile, hydrated, updateProfile, setCurrentStep, markCompleted, beginEditing, isComplete } =
    useOwnershipProfileStorage(token);

  // Returning after completion opens straight to the saved profile;
  // otherwise resume wherever they left off (clamped to a valid step).
  // `STEPS.length` (one past the last input step) represents the summary.
  const step = isComplete
    ? STEPS.length
    : Math.min(Math.max(profile.currentStep, 0), STEPS.length);

  const answeredCount = useMemo(() => countAnsweredSections(profile), [profile]);
  const onSummary = step === STEPS.length;
  const progressValue = onSummary
    ? 100
    : (answeredCount / OWNERSHIP_PROFILE_SECTION_COUNT) * 100;

  const goTo = (next: number) => {
    setCurrentStep(Math.min(Math.max(next, 0), STEPS.length));
  };

  if (!hydrated) {
    return (
      <Card>
        <CardContent className="p-6 sm:p-8">
          <div className="h-[7px] w-full animate-pulse rounded-full bg-[#e9edf2]" />
          <div className="mt-9 h-6 w-2/3 animate-pulse rounded bg-[#e9edf2]" />
          <div className="mt-4 h-24 w-full animate-pulse rounded bg-[#f2f4f7]" />
        </CardContent>
      </Card>
    );
  }

  if (onSummary) {
    return (
      <Card>
        <CardContent className="ownership-profile-step p-6 sm:p-8">
          <ProfileSummary
            profile={profile}
            isSaved={isComplete}
            onSave={markCompleted}
            onEdit={() => beginEditing(0)}
            token={token}
            brandName={brandName}
          />
        </CardContent>
      </Card>
    );
  }

  const current = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  return (
    <Card>
      <CardContent className="p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4 text-[12px] text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">
              Step {step + 1} of {STEPS.length}
            </span>{" "}
            — {current.title}
          </span>
          <span>{Math.round(progressValue)}% complete</span>
        </div>
        <Progress value={progressValue} className="mt-2" aria-label="Ownership Profile progress" />

        <div key={step} className="ownership-profile-step mt-9">
          {current.render(profile, updateProfile)}
        </div>

        <div className="mt-10 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => goTo(step - 1)}
            disabled={step === 0}
          >
            <ArrowLeft className="size-4" strokeWidth={1.8} />
            Back
          </Button>
          <Button type="button" onClick={() => goTo(step + 1)}>
            {isLastStep ? "View My Profile" : "Continue"}
            <ArrowRight className="size-4" strokeWidth={1.8} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
