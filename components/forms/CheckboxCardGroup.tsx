"use client";

import type { UseFormRegister } from "react-hook-form";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuestionnairePayload } from "@/lib/validation/questionnaire";

interface CheckboxCardGroupProps {
  name: keyof QuestionnairePayload;
  register: UseFormRegister<QuestionnairePayload>;
  options: ReadonlyArray<{ value: string; label: string }>;
  error?: boolean;
  columns?: 1 | 2;
}

/**
 * Multi-select companion to RadioCardGroup: native checkboxes registered
 * under one array field, styled as selectable cards. RHF collects checked
 * values into a string array automatically.
 */
export function CheckboxCardGroup({
  name,
  register,
  options,
  error,
  columns = 2,
}: CheckboxCardGroupProps) {
  return (
    <div
      role="group"
      aria-invalid={error}
      className={cn("grid gap-2.5", columns === 2 && "sm:grid-cols-2")}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:ring-1 has-[:checked]:ring-primary/15",
            "flex cursor-pointer items-center gap-3 rounded-control border border-border bg-card px-3.5 py-3 text-[13.5px] text-foreground transition-colors hover:border-border-strong",
            error && "border-destructive/40",
          )}
        >
          <input type="checkbox" value={option.value} className="peer sr-only" {...register(name)} />
          <span
            aria-hidden
            className="peer-checked:border-primary peer-checked:bg-primary flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-border-strong text-card transition-colors [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100"
          >
            <Check className="size-3" strokeWidth={3} />
          </span>
          <span className="font-medium">{option.label}</span>
        </label>
      ))}
    </div>
  );
}
