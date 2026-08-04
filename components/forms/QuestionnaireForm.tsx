"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Label, NativeSelect, Textarea } from "@/components/ui/form-fields";
import { questionnaireSchema, type QuestionnairePayload } from "@/lib/validation/questionnaire";
import {
  BUSINESS_OWNERSHIP_OPTIONS,
  DECISION_PARTICIPANT_OPTIONS,
  INVESTMENT_TIMELINES,
  LIQUID_CAPITAL_RANGES,
  NET_WORTH_RANGES,
} from "@/types/questionnaire";

interface QuestionnaireFormProps {
  token: string;
}

export function QuestionnaireForm({ token }: QuestionnaireFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<QuestionnairePayload>({
    resolver: zodResolver(questionnaireSchema),
  });

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

  const selectFields = [
    {
      name: "investmentTimeline" as const,
      label: "1. What is your investment timeline?",
      options: INVESTMENT_TIMELINES,
    },
    {
      name: "liquidCapital" as const,
      label: "2. What liquid capital do you have available?",
      options: LIQUID_CAPITAL_RANGES,
    },
    {
      name: "netWorth" as const,
      label: "3. What is your estimated net worth?",
      options: NET_WORTH_RANGES,
    },
    {
      name: "businessOwnership" as const,
      label: "4. Have you owned or operated a business?",
      options: BUSINESS_OWNERSHIP_OPTIONS,
    },
  ];

  const textFields = [
    {
      name: "primaryInterest" as const,
      label: "5. What interested you most about the opportunity?",
    },
    {
      name: "remainingQuestions" as const,
      label: "6. What questions would you like answered during your consultation?",
    },
    {
      name: "decisionCriteria" as const,
      label: "7. What would need to be true for this opportunity to make sense for you?",
    },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} onChange={markStarted} className="space-y-6" noValidate>
      {selectFields.map((field) => (
        <div key={field.name}>
          <Label htmlFor={field.name}>{field.label}</Label>
          <NativeSelect
            id={field.name}
            defaultValue=""
            aria-invalid={Boolean(errors[field.name])}
            className="mt-2"
            {...register(field.name)}
          >
            <option value="" disabled>
              Select an option
            </option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
          <FieldError message={errors[field.name] ? "Please select an option" : undefined} />
        </div>
      ))}

      {textFields.map((field) => (
        <div key={field.name}>
          <Label htmlFor={field.name}>{field.label}</Label>
          <Textarea
            id={field.name}
            rows={4}
            aria-invalid={Boolean(errors[field.name])}
            className="mt-2"
            {...register(field.name)}
          />
          <FieldError message={errors[field.name]?.message as string | undefined} />
        </div>
      ))}

      <div>
        <Label htmlFor="decisionParticipants">
          8. Who else, if anyone, would be involved in the decision?
        </Label>
        <NativeSelect
          id="decisionParticipants"
          defaultValue=""
          aria-invalid={Boolean(errors.decisionParticipants)}
          className="mt-2"
          {...register("decisionParticipants")}
        >
          <option value="" disabled>
            Select an option
          </option>
          {DECISION_PARTICIPANT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
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

      {serverError && (
        <div
          role="alert"
          className="rounded-control border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {serverError}
        </div>
      )}

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
        {isSubmitting && <Loader2 className="animate-spin" />}
        {isSubmitting ? "Submitting…" : "Submit &amp; Prepare My Consultation"}
      </Button>
    </form>
  );
}
