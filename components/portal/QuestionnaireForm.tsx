"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

type FieldErrors = Partial<Record<string, string[]>>;

const selectClass =
  "mt-2 block w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";
const textareaClass =
  "mt-2 block w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";
const labelClass = "block text-sm font-medium text-ink";

export function QuestionnaireForm({ token }: QuestionnaireFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const startedRef = useRef(false);

  const markStarted = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, eventName: "questionnaire_started" }),
    }).catch(() => undefined);
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const payload = {
      investmentTimeline: form.get("investmentTimeline"),
      liquidCapital: form.get("liquidCapital"),
      netWorth: form.get("netWorth"),
      businessOwnership: form.get("businessOwnership"),
      primaryInterest: form.get("primaryInterest"),
      remainingQuestions: form.get("remainingQuestions"),
      decisionCriteria: form.get("decisionCriteria"),
      decisionParticipants: form.get("decisionParticipants"),
      accuracyConfirmed: form.get("accuracyConfirmed") === "on",
    };

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
        details?: FieldErrors;
      };

      if (data.success && data.nextUrl) {
        router.push(data.nextUrl);
        router.refresh();
        return;
      }

      setFieldErrors(data.details ?? {});
      setError(
        data.error ??
          "Your responses could not be saved. Please check your connection and try again.",
      );
      setSubmitting(false);
    } catch {
      setError("Your responses could not be saved. Please check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} onChange={markStarted} className="space-y-6" noValidate>
      <SelectField
        name="investmentTimeline"
        label="1. What is your investment timeline?"
        options={INVESTMENT_TIMELINES}
        errors={fieldErrors.investmentTimeline}
      />
      <SelectField
        name="liquidCapital"
        label="2. What liquid capital do you have available?"
        options={LIQUID_CAPITAL_RANGES}
        errors={fieldErrors.liquidCapital}
      />
      <SelectField
        name="netWorth"
        label="3. What is your estimated net worth?"
        options={NET_WORTH_RANGES}
        errors={fieldErrors.netWorth}
      />
      <SelectField
        name="businessOwnership"
        label="4. Have you owned or operated a business?"
        options={BUSINESS_OWNERSHIP_OPTIONS}
        errors={fieldErrors.businessOwnership}
      />
      <TextField
        name="primaryInterest"
        label="5. What interested you most about the opportunity?"
        errors={fieldErrors.primaryInterest}
      />
      <TextField
        name="remainingQuestions"
        label="6. What questions would you like answered during your consultation?"
        errors={fieldErrors.remainingQuestions}
      />
      <TextField
        name="decisionCriteria"
        label="7. What would need to be true for this opportunity to make sense for you?"
        errors={fieldErrors.decisionCriteria}
      />
      <SelectField
        name="decisionParticipants"
        label="8. Who else, if anyone, would be involved in the decision?"
        options={DECISION_PARTICIPANT_OPTIONS}
        errors={fieldErrors.decisionParticipants}
      />

      <div>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="accuracyConfirmed"
            required
            className="mt-0.5 h-5 w-5 rounded border-line text-brand focus:ring-brand/30"
          />
          <span className="text-sm text-ink">
            I confirm that the information provided is accurate.
          </span>
        </label>
        {fieldErrors.accuracyConfirmed?.[0] && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.accuracyConfirmed[0]}</p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-brand px-6 py-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60 sm:w-auto"
      >
        {submitting ? "Submitting…" : "Submit Questionnaire"}
      </button>
    </form>
  );
}

function SelectField({
  name,
  label,
  options,
  errors,
}: {
  name: string;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  errors?: string[];
}) {
  return (
    <div>
      <label htmlFor={name} className={labelClass}>
        {label}
      </label>
      <select id={name} name={name} required defaultValue="" className={selectClass}>
        <option value="" disabled>
          Select an option
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {errors?.[0] && <p className="mt-1 text-sm text-red-600">{errors[0]}</p>}
    </div>
  );
}

function TextField({ name, label, errors }: { name: string; label: string; errors?: string[] }) {
  return (
    <div>
      <label htmlFor={name} className={labelClass}>
        {label}
      </label>
      <textarea id={name} name={name} rows={4} required className={textareaClass} />
      {errors?.[0] && <p className="mt-1 text-sm text-red-600">{errors[0]}</p>}
    </div>
  );
}
