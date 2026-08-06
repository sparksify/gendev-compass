"use client";

import type { UseFormRegister } from "react-hook-form";
import { cn } from "@/lib/utils";
import type { QuestionnairePayload } from "@/lib/validation/questionnaire";

interface RadioCardGroupProps {
  name: keyof QuestionnairePayload;
  register: UseFormRegister<QuestionnairePayload>;
  options: ReadonlyArray<{ value: string; label: string }>;
  error?: boolean;
  /** Two-up on wider screens when there's room; single column otherwise. */
  columns?: 1 | 2;
}

/**
 * A visually upgraded stand-in for a native <select>: real radio inputs
 * (still registered through React Hook Form, same field name and values)
 * styled as selectable cards. Purely presentational — stored values and
 * validation are unchanged.
 */
export function RadioCardGroup({
  name,
  register,
  options,
  error,
  columns = 1,
}: RadioCardGroupProps) {
  return (
    <div
      role="radiogroup"
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
          <input
            type="radio"
            value={option.value}
            className="peer sr-only"
            {...register(name)}
          />
          <span
            aria-hidden
            className="peer-checked:border-primary peer-checked:bg-primary relative flex size-4 shrink-0 items-center justify-center rounded-full border border-border-strong transition-colors after:block after:size-1.5 after:rounded-full after:bg-card after:opacity-0 after:transition-opacity peer-checked:after:opacity-100"
          />
          <span className="font-medium">{option.label}</span>
        </label>
      ))}
    </div>
  );
}
