"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FieldError, Input, Label, NativeSelect, Textarea } from "@/components/ui/form-fields";
import { RadioCardGroup } from "@/components/forms/RadioCardGroup";
import { CheckboxCardGroup } from "@/components/forms/CheckboxCardGroup";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import {
  financingDetailsApply,
  questionnaireSchema,
  type QuestionnairePayload,
} from "@/lib/validation/questionnaire";
import {
  BUSINESS_OWNERSHIP_OPTIONS,
  CASH_CONTRIBUTION_RANGES,
  CREDIT_SCORE_RANGES,
  DECISION_PARTICIPANT_OPTIONS,
  EXISTING_ENTITY_OPTIONS,
  FINANCING_NEED_OPTIONS,
  FINANCING_PERCENTAGE_OPTIONS,
  FUNDING_ASSISTANCE_OPTIONS,
  FUNDING_SOURCE_OPTIONS,
  INVESTMENT_TIMELINES,
  LENDER_STATUS_OPTIONS,
  LIQUID_CAPITAL_RANGES,
  NET_WORTH_RANGES,
  PRIOR_FINANCING_EXPERIENCE_OPTIONS,
} from "@/types/questionnaire";
import { COUNTRY_OPTIONS, DEFAULT_COUNTRY, US_STATES } from "@/types/address";

interface QuestionnaireFormProps {
  token: string;
  advisorName: string;
  /** Known answers from the original application, used to pre-fill fields. */
  defaults?: Partial<Pick<QuestionnairePayload, "liquidCapital" | "netWorth">>;
}

function whatsNext(advisorName: string) {
  return [
    `${advisorName} personally reviews every response before your call`,
    "Your consultation is tailored to your goals, timeline, and experience",
    "You'll walk through the opportunity and get your questions answered",
    "Together, you'll determine whether this is a strong mutual fit",
    "No pressure — this is a conversation, not a sales pitch",
  ];
}

const filled = (value: unknown): boolean =>
  Array.isArray(value)
    ? value.length > 0
    : typeof value === "string" && value.trim().length > 0;

export function QuestionnaireForm({ token, advisorName, defaults }: QuestionnaireFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const sectionEventsSent = useRef(new Set<string>());

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<QuestionnairePayload>({
    resolver: zodResolver(questionnaireSchema),
    defaultValues: { country: DEFAULT_COUNTRY, ...defaults },
  });

  const values = useWatch({ control });
  const isUS = values.country === DEFAULT_COUNTRY;
  const showFinancingDetails = financingDetailsApply(values.financingNeed);

  // Dynamic progress: the financing-dependent trio only counts when shown.
  const requiredValues: unknown[] = [
    values.investmentTimeline,
    values.liquidCapital,
    values.netWorth,
    values.addressLine1,
    values.city,
    values.state,
    values.postalCode,
    values.country,
    values.estimatedCreditScoreRange,
    values.anticipatedFundingSources,
    values.financingNeed,
    ...(showFinancingDetails
      ? [values.preferredFinancingPercentage, values.lenderStatus, values.fundingAssistanceRequested]
      : []),
    values.availableCashContribution,
    values.existingBusinessEntity,
    values.priorBusinessFinancingExperience,
    values.businessOwnership,
    values.primaryInterest,
    values.remainingQuestions,
    values.decisionCriteria,
    values.decisionParticipants,
  ];
  const totalQuestions = requiredValues.length;
  const completedCount = requiredValues.filter(filled).length;

  const sendSectionEvent = (eventName: string) => {
    if (sectionEventsSent.current.has(eventName)) return;
    sectionEventsSent.current.add(eventName);
    // Workflow signal only — never answer values (privacy spec §12/§15).
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, eventName }),
    }).catch(() => undefined);
  };

  const locationComplete = [
    values.addressLine1,
    values.city,
    values.state,
    values.postalCode,
    values.country,
  ].every(filled);
  const fundingStarted = [
    values.estimatedCreditScoreRange,
    values.anticipatedFundingSources,
    values.financingNeed,
  ].some(filled);
  const fundingComplete =
    [
      values.estimatedCreditScoreRange,
      values.anticipatedFundingSources,
      values.financingNeed,
      values.availableCashContribution,
      ...(showFinancingDetails
        ? [values.preferredFinancingPercentage, values.lenderStatus, values.fundingAssistanceRequested]
        : []),
    ].every(filled) && filled(values.financingNeed);

  useEffect(() => {
    if (locationComplete) sendSectionEvent("location_section_completed");
    if (fundingStarted) sendSectionEvent("funding_section_started");
    if (fundingComplete) sendSectionEvent("funding_section_completed");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationComplete, fundingStarted, fundingComplete]);

  const markStarted = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, eventName: "questionnaire_started" }),
    }).catch(() => undefined);
  };

  const onSubmit = async (payload: QuestionnairePayload) => {
    setServerError(null);
    try {
      const response = await fetch(`/api/portal/${token}/questionnaire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        success: boolean;
        nextUrl?: string;
        error?: string;
      };
      if (data.success && data.nextUrl) {
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
          <span className="font-semibold text-foreground">
            {completedCount} of {totalQuestions}
          </span>{" "}
          questions completed
        </span>
        {completedCount === totalQuestions && (
          <span className="inline-flex items-center gap-1 font-medium text-success">
            <Check className="size-3.5" strokeWidth={2.2} /> Ready to submit
          </span>
        )}
      </div>
      <Progress
        value={(completedCount / totalQuestions) * 100}
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

        {/* Section 2 — Your Location */}
        <div>
          <SectionHeader
            number={2}
            title="Your Location"
            description="Your location helps your advisor review territory availability and market fit for your area."
          />
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="addressLine1">Street address</Label>
              <Input
                id="addressLine1"
                autoComplete="address-line1"
                aria-invalid={Boolean(errors.addressLine1)}
                className="mt-2"
                {...register("addressLine1")}
              />
              <FieldError message={errors.addressLine1?.message} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="addressLine2">
                Address line 2 <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="addressLine2"
                autoComplete="address-line2"
                className="mt-2"
                {...register("addressLine2")}
              />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                autoComplete="address-level2"
                aria-invalid={Boolean(errors.city)}
                className="mt-2"
                {...register("city")}
              />
              <FieldError message={errors.city?.message} />
            </div>
            <div>
              <Label htmlFor="state">{isUS ? "State" : "State / Province"}</Label>
              {isUS ? (
                <NativeSelect
                  id="state"
                  defaultValue=""
                  autoComplete="address-level1"
                  aria-invalid={Boolean(errors.state)}
                  className="mt-2"
                  {...register("state")}
                >
                  <option value="" disabled>
                    Select a state
                  </option>
                  {US_STATES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <Input
                  id="state"
                  autoComplete="address-level1"
                  aria-invalid={Boolean(errors.state)}
                  className="mt-2"
                  {...register("state")}
                />
              )}
              <FieldError message={errors.state?.message} />
            </div>
            <div>
              <Label htmlFor="postalCode">{isUS ? "ZIP code" : "Postal code"}</Label>
              <Input
                id="postalCode"
                inputMode={isUS ? "numeric" : "text"}
                autoComplete="postal-code"
                aria-invalid={Boolean(errors.postalCode)}
                className="mt-2"
                {...register("postalCode")}
              />
              <FieldError message={errors.postalCode?.message} />
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <NativeSelect
                id="country"
                autoComplete="country-name"
                aria-invalid={Boolean(errors.country)}
                className="mt-2"
                {...register("country")}
              >
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
              <FieldError message={errors.country?.message} />
            </div>
          </div>
        </div>

        <div className="border-t border-border-soft" aria-hidden />

        {/* Section 3 — Credit Profile */}
        <div>
          <SectionHeader
            number={3}
            title="Credit Profile"
            description="These questions help us understand what funding options may be appropriate if financing is part of your investment plan. This is not a credit application and does not authorize a credit inquiry."
          />
          <div className="mt-5">
            <Label>What is your estimated personal credit score?</Label>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              A range is all we need — no exact score, and no credit check is performed.
            </p>
            <div className="mt-2.5">
              <RadioCardGroup
                name="estimatedCreditScoreRange"
                register={register}
                options={CREDIT_SCORE_RANGES}
                error={Boolean(errors.estimatedCreditScoreRange)}
                columns={2}
              />
            </div>
            <FieldError
              message={errors.estimatedCreditScoreRange ? "Please select an option" : undefined}
            />
          </div>
        </div>

        <div className="border-t border-border-soft" aria-hidden />

        {/* Section 4 — Investment Funding */}
        <div>
          <SectionHeader
            number={4}
            title="Investment Funding"
            description="Understanding how you plan to fund the investment helps your advisor prepare relevant options — financing is common and does not affect your eligibility."
          />
          <div className="mt-5 space-y-6">
            <div>
              <Label>How do you expect to fund the investment?</Label>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                Select all that apply.
              </p>
              <div className="mt-2.5">
                <CheckboxCardGroup
                  name="anticipatedFundingSources"
                  register={register}
                  options={FUNDING_SOURCE_OPTIONS}
                  error={Boolean(errors.anticipatedFundingSources)}
                />
              </div>
              <FieldError
                message={
                  errors.anticipatedFundingSources
                    ? "Select at least one funding source"
                    : undefined
                }
              />
            </div>

            <div>
              <Label>Will you likely need financing to complete the investment?</Label>
              <div className="mt-2.5">
                <RadioCardGroup
                  name="financingNeed"
                  register={register}
                  options={FINANCING_NEED_OPTIONS}
                  error={Boolean(errors.financingNeed)}
                />
              </div>
              <FieldError message={errors.financingNeed ? "Please select an option" : undefined} />
            </div>

            {showFinancingDetails && (
              <>
                <div>
                  <Label>Approximately how much of the investment would you prefer to finance?</Label>
                  <div className="mt-2.5">
                    <RadioCardGroup
                      name="preferredFinancingPercentage"
                      register={register}
                      options={FINANCING_PERCENTAGE_OPTIONS}
                      error={Boolean(errors.preferredFinancingPercentage)}
                      columns={2}
                    />
                  </div>
                  <FieldError
                    message={errors.preferredFinancingPercentage ? "Please select an option" : undefined}
                  />
                </div>
                <div>
                  <Label>Have you already spoken with a lender or funding provider?</Label>
                  <div className="mt-2.5">
                    <RadioCardGroup
                      name="lenderStatus"
                      register={register}
                      options={LENDER_STATUS_OPTIONS}
                      error={Boolean(errors.lenderStatus)}
                    />
                  </div>
                  <FieldError message={errors.lenderStatus ? "Please select an option" : undefined} />
                </div>
                <div>
                  <Label>Would you like help exploring financing options?</Label>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    Many investors use financing — your advisor can connect you with experienced
                    funding partners if helpful.
                  </p>
                  <div className="mt-2.5">
                    <RadioCardGroup
                      name="fundingAssistanceRequested"
                      register={register}
                      options={FUNDING_ASSISTANCE_OPTIONS}
                      error={Boolean(errors.fundingAssistanceRequested)}
                      columns={2}
                    />
                  </div>
                  <FieldError
                    message={errors.fundingAssistanceRequested ? "Please select an option" : undefined}
                  />
                </div>
              </>
            )}

            <div>
              <Label>
                How much cash or liquid capital would you be comfortable contributing toward the
                investment?
              </Label>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                This is about what you&rsquo;d comfortably deploy — separate from your total liquid
                capital above.
              </p>
              <div className="mt-2.5">
                <RadioCardGroup
                  name="availableCashContribution"
                  register={register}
                  options={CASH_CONTRIBUTION_RANGES}
                  error={Boolean(errors.availableCashContribution)}
                  columns={2}
                />
              </div>
              <FieldError
                message={errors.availableCashContribution ? "Please select an option" : undefined}
              />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <Label>Do you currently have an existing business entity?</Label>
                <div className="mt-2.5">
                  <RadioCardGroup
                    name="existingBusinessEntity"
                    register={register}
                    options={EXISTING_ENTITY_OPTIONS}
                    error={Boolean(errors.existingBusinessEntity)}
                  />
                </div>
                <FieldError
                  message={errors.existingBusinessEntity ? "Please select an option" : undefined}
                />
              </div>
              <div>
                <Label>Have you used SBA or commercial financing before?</Label>
                <div className="mt-2.5">
                  <RadioCardGroup
                    name="priorBusinessFinancingExperience"
                    register={register}
                    options={PRIOR_FINANCING_EXPERIENCE_OPTIONS}
                    error={Boolean(errors.priorBusinessFinancingExperience)}
                  />
                </div>
                <FieldError
                  message={
                    errors.priorBusinessFinancingExperience ? "Please select an option" : undefined
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border-soft" aria-hidden />

        {/* Section 5 — Business Experience */}
        <div>
          <SectionHeader
            number={5}
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

        {/* Section 6 — Opportunity Fit */}
        <div>
          <SectionHeader
            number={6}
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
              <FieldError message={errors.primaryInterest?.message} />
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
              <FieldError message={errors.remainingQuestions?.message} />
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
              <FieldError message={errors.decisionCriteria?.message} />
            </div>
          </div>
        </div>

        <div className="border-t border-border-soft" aria-hidden />

        {/* Section 7 — Decision Process */}
        <div>
          <SectionHeader
            number={7}
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
              <FieldError message={errors.accuracyConfirmed?.message} />
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
