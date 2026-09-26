"use client";

import { useState } from "react";
import { LIQUID_CAPITAL_OPTIONS, TIMELINE_OPTIONS } from "@/lib/bridge/assessment";

const householdOptions = [
  ["yes", "Yes, I included household liquid assets"],
  ["no", "No, I only included assets in my name"],
  ["not-sure", "I’m not sure"],
] as const;

const resourceOptions = [
  ["none", "No additional resources right now"],
  ["household-assets", "Additional household liquid assets"],
  ["other", "Other resources I’d like to discuss"],
  ["not-sure", "I’m not sure yet"],
] as const;

const inputClass = "mt-2 w-full rounded-md border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export function FinancialClarificationForm({ token, initialCapital }: { token: string; initialCapital: string | null }) {
  const [liquidCapital, setLiquidCapital] = useState(initialCapital ?? "not-sure");
  const [householdAssetsIncluded, setHouseholdAssetsIncluded] = useState("");
  const [additionalResources, setAdditionalResources] = useState("");
  const [timeline, setTimeline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/portal/${token}/financial-clarification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liquidCapital, householdAssetsIncluded, additionalResources, timeline }),
      });
      const data = await response.json() as { nextUrl?: string; error?: string };
      if (!response.ok || !data.nextUrl) throw new Error(data.error ?? "We couldn’t save those answers.");
      window.location.assign(data.nextUrl);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "We couldn’t save those answers. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <label className="block text-sm font-semibold text-sidebar">
        Approximately how much liquid capital do you currently have available toward a business investment?
        <select className={inputClass} value={liquidCapital} onChange={(event) => setLiquidCapital(event.target.value)} required>
          <option value="">Select one</option>
          {LIQUID_CAPITAL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>

      <fieldset>
        <legend className="text-sm font-semibold text-sidebar">Did your original answer include all household liquid assets?</legend>
        <div className="mt-2 space-y-2">
          {householdOptions.map(([value, label]) => <label key={value} className="flex items-start gap-3 rounded-md border border-border px-4 py-3 text-sm text-foreground"><input className="mt-0.5" type="radio" name="householdAssetsIncluded" value={value} checked={householdAssetsIncluded === value} onChange={() => setHouseholdAssetsIncluded(value)} required />{label}</label>)}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-sidebar">Are there other resources relevant to your situation?</legend>
        <div className="mt-2 space-y-2">
          {resourceOptions.map(([value, label]) => <label key={value} className="flex items-start gap-3 rounded-md border border-border px-4 py-3 text-sm text-foreground"><input className="mt-0.5" type="radio" name="additionalResources" value={value} checked={additionalResources === value} onChange={() => setAdditionalResources(value)} required />{label}</label>)}
        </div>
      </fieldset>

      <label className="block text-sm font-semibold text-sidebar">
        If CMDT is a fit, when would you ideally want to move forward?
        <select className={inputClass} value={timeline} onChange={(event) => setTimeline(event.target.value)} required>
          <option value="">Select one</option>
          {TIMELINE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>

      {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-sidebar px-6 text-sm font-semibold text-white hover:bg-sidebar/90 disabled:cursor-wait disabled:opacity-60">
        {submitting ? "Saving…" : "Complete the short financial profile"}
      </button>
    </form>
  );
}
