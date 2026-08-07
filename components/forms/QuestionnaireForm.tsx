"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FieldError, Label, Textarea } from "@/components/ui/form-fields";
import { RadioCardGroup } from "@/components/forms/RadioCardGroup";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { questionnaireSchema, type QuestionnairePayload } from "@/lib/validation/questionnaire";
import { firePortalTrackingResults, type PortalTrackingResult } from "@/lib/tracking/client";
import {
  BUSINESS_OWNERSHIP_OPTIONS,
  DECISION_PARTICIPANT_OPTIONS,
  INVESTMENT_TIMELINES,
  LIQUID_CAPITAL_RANGES,
  NET_WORTH_RANGES,
} from "@/types/questionnaire";

interface QuestionnaireFormProps {
  token: string;
  advisorName: string;
  /** Known answers from the original application, used to pre-fill fields. */
  defaults?: Partial<Pick<QuestionnairePayload, "liquidCapital" | "netWorth">>;
}

const TOTAL_QUESTIONS = 8;

function whatsNext(advisorName: string) {
  return [
    `${advisorName} personally reviews every response before your call`,
    "Your consultation is tailored to your goals, timeline, and experience",
    "You'll walk through the opportunity and get your questions answered",
    "Together, you'll determine whether this is a strong mutual fit",
    "No pressure — this is a conversation, not a sales pitch",
  ];
}

export function QuestionnaireForm({ token, advisorName, defaults }: QuestionnaireFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<QuestionnairePayload>({
    resolver: zodResolver(questionnaireSchema),
    defaultValues: defaults,
  });

  const values = useWatch({ control });
  const completedCount = [
    values.investmentTimeline,
    values.liquidCapital,
    values.netWorth,
    values.businessOwnership,
    values.primaryInterest,
    values.remainingQuestions,
    values.decisionCriteria,
    values.decisionParticipants,
  ].filter((value) => typeof value === "string" && value.trim().length > 0).length;

  const markStarted = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, eventName: "questionnaire_started" }),
    }).catch(() => undefined);
  };

  const onSubmit = async (values: QuestionnairePayload) => {
    setServerError(null);
    try {
      const response = await fetch(`/api/portal/${token}/questionnaire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as {
        success: boolean;
        nextUrl?: string;
        error?: string;
        tracking?: PortalTrackingResult[];
      };
      if (data.success && data.nextUrl) {
        firePortalTrackingResults(data.tracking ?? []);
        router.push(data.nextUrl);
        router.refresh();
        return;
      }
      setServerError(
        data.error ??
          "Your responses could not be saved. Please check your connection and try again.",
      );
    } catch {
      setServerError(
        "Your responses could not be saved. Please check your connection and try again.",
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} onChange={markStarted} noValidate>
      <div className="flex items-center justify-between gap-4 text-[12px] text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{completedCount} of {TOTAL_QUESTIONS}</span>{" "}
          questions completed
        </span>
        {completedCount === TOTAL_QUESTIONS && (
          <span className="inline-flex items-center gap-1 font-medium text-success">
            <Check className="size-3.5" strokeWidth={2.2} /> Ready to submit
          </span>
        )}
      </div>
      <Progress
        value={(completedCount / TOTAL_QUESTIONS) * 100}
        className="mt-2"
        aria-label="Questionnaire progress"
      />

      <div className="mt-9 space-y-9">
        {/* Section 1 — Investment Goals */}
        <div>
          <SectionHeader
            number={1}
            title="Investment Goals"
            description="Your timeline and financial readiness help shape the pace of your consultation."
          />
          <div className="mt-5 space-y-6">
            <div>
              <Label>What is your investment timeline?</Label>
              <div className="mt-2.5">
                <RadioCardGroup
                  name="investmentTimeline"
                  register={register}
                  options={INVESTMENT_TIMELINES}
                  error={Boolean(errors.investmentTimeline)}
                  columns={2}
                />
              </div>
              <FieldError message={errors.investmentTimeline ? "Please select an option" : undefined} />
            </div>
            <div>
              <Label>What liquid capital do you have available?</Label>
              <div className="mt-2.5">
                <RadioCardGroup
                  name="liquidCapital"
                  register={register}
                  options={LIQUID_CAPITAL_RANGES}
                  error={Boolean(errors.liquidCapital)}
                  columns={2}
                />
              </div>
              <FieldError message={errors.liquidCapital ? "Please select an option" : undefined} />
            </div>
            <div>
              <Label>What is your estimated net worth?</Label>
              <div className="mt-2.5">
                <RadioCardGroup
                  name="netWorth"
                  register={register}
                  options={NET_WORTH_RANGES}
                  error={Boolean(errors.netWorth)}
                  columns={2}
                />
              </div>
              <FieldError message={errors.netWorth ? "Please select an option" : undefined} />
            </div>
          </div>
        </div>

        <div className="border-t border-border-soft" aria-hidden />

        {/* Section 2 — Business Experience */}
        <div>
          <SectionHeader
            number={2}
            title="Business Experience"
            description="Your background helps your advisor calibrate the conversation."
          />
          <div className="mt-5">
            <Label>Have you owned or operated a business?</Label>
            <div className="mt-2.5">
              <RadioCardGroup
                name="businessOwnership"
                register={register}
                options={BUSINESS_OWNERSHIP_OPTIONS}
                error={Boolean(errors.businessOwnership)}
              />
            </div>
            <FieldError message={errors.businessOwnership ? "Please select an option" : undefined} />
          </div>
        </div>

        <div className="border-t border-border-soft" aria-hidden />

        {/* Section 3 — Opportunity Fit */}
        <div>
          <SectionHeader
            number={3}
            title="Opportunity Fit"
            description="Tell us what matters most so your advisor can focus your time together."
          />
          <div className="mt-5 space-y-6">
            <div>
              <Label htmlFor="primaryInterest">What interested you most about the opportunity?</Label>
              <Textarea
                id="primaryInterest"
                rows={4}
                aria-invalid={Boolean(errors.primaryInterest)}
                className="mt-2"
                {...register("primaryInterest")}
              />
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                Examples: recurring revenue • lifestyle • semi-absentee ownership • medical industry
                • long-term investment
              </p>
              <FieldError message={errors.primaryInterest?.message as string | undefined} />
            </div>
            <div>
              <Label htmlFor="remainingQuestions">
                What questions would you like answered during your consultation?
              </Label>
              <Textarea
                id="remainingQuestions"
                rows={4}
                aria-invalid={Boolean(errors.remainingQuestions)}
                className="mt-2"
                {...register("remainingQuestions")}
              />
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                Examples: territory availability • financing options • day-to-day operations •
                support &amp; training
              </p>
              <FieldError message={errors.remainingQuestions?.message as string | undefined} />
            </div>
            <div>
              <Label htmlFor="decisionCriteria">
                What would need to be true for this opportunity to make sense for you?
              </Label>
              <Textarea
                id="decisionCriteria"
                rows={4}
                aria-invalid={Boolean(errors.decisionCriteria)}
                className="mt-2"
                {...register("decisionCriteria")}
              />
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                Examples: financing approval • territory confirmation • discussing with my spouse
                or partner • reviewing the FDD
              </p>
              <FieldError message={errors.decisionCriteria?.message as string | undefined} />
            </div>
          </div>
        </div>

        <div className="border-t border-border-soft" aria-hidden />

        {/* Section 4 — Decision Process */}
        <div>
          <SectionHeader
            number={4}
            title="Decision Process"
            description="A quick confirmation before your responses are sent to your advisor."
          />
          <div className="mt-5 space-y-6">
            <div>
              <Label>Who else, if anyone, would be involved in the decision?</Label>
              <div className="mt-2.5">
                <RadioCardGroup
                  name="decisionParticipants"
                  register={register}
                  options={DECISION_PARTICIPANT_OPTIONS}
                  error={Boolean(errors.decisionParticipants)}
                  columns={2}
                />
              </div>
              <FieldError
                message={errors.decisionParticipants ? "Please select an option" : undefined}
              />
            </div>
            <div>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 rounded border-border text-primary focus:ring-primary/30"
                  {...register("accuracyConfirmed")}
                />
                <span className="text-sm text-foreground">
                  I confirm that the information provided is accurate.
                </span>
              </label>
              <FieldError message={errors.accuracyConfirmed?.message as string | undefined} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-9 rounded-control border border-border-soft bg-surface p-5 sm:p-6">
        <h3 className="text-[13.5px] font-bold text-foreground">What happens next?</h3>
        <ul className="mt-3 space-y-2.5">
          {whatsNext(advisorName).map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-muted-foreground">
              <Check className="mt-0.5 size-3.5 shrink-0 text-success" strokeWidth={2.2} />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {serverError && (
        <div
          role="alert"
          className="mt-6 rounded-control border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {serverError}
        </div>
      )}

      <div className="mt-8 flex flex-col items-center gap-2.5">
        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting && <Loader2 className="animate-spin" />}
          {isSubmitting ? "Submitting…" : "Prepare My Consultation"}
        </Button>
        <p className="text-center text-[12px] text-muted-foreground">
          Your advisor will review your responses before your scheduled consultation.
        </p>
      </div>
    </form>
  );
}
