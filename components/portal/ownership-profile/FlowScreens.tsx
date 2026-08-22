"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ownershipStyleLabel } from "@/types/ownershipProfile";

/**
 * Presentational pieces for the one-question-at-a-time Ownership Profile
 * flow. Every screen is a single decision with large tap targets and an
 * auto-advance, so completing the assessment feels like a quick exchange
 * rather than a form. Orchestration (ordering, persistence, advancing)
 * lives in OwnershipProfileAssessment.
 */

interface ScreenShellProps {
  eyebrow: string;
  prompt: string;
  helper?: string;
  /** Focused on mount so keyboard/screen-reader users land on the question. */
  promptRef?: React.Ref<HTMLHeadingElement>;
  children: React.ReactNode;
}

export function ScreenShell({ eyebrow, prompt, helper, promptRef, children }: ScreenShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-[540px] flex-col items-stretch text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-gold">
        {eyebrow}
      </p>
      <h2
        ref={promptRef}
        tabIndex={-1}
        className="mt-2.5 font-serif text-[24px] font-normal leading-[1.2] text-foreground outline-none sm:text-[28px]"
      >
        {prompt}
      </h2>
      {helper && (
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{helper}</p>
      )}
      <div className="mt-8">{children}</div>
    </div>
  );
}

interface BinaryChoiceProps {
  /** Current answer: true (yes), false (no), or undefined (not answered). */
  value: boolean | undefined;
  onAnswer: (yes: boolean) => void;
  disabled?: boolean;
}

/** Two large yes/no targets — the rapid-fire unit of the flow. */
export function BinaryChoice({ value, onAnswer, disabled }: BinaryChoiceProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAnswer(true)}
        className={cn(
          "ownership-flow-option flex flex-col items-center gap-2 rounded-card border bg-card px-4 py-6 text-[15px] font-semibold text-foreground transition-colors",
          value === true
            ? "border-primary bg-primary-soft ring-1 ring-primary/20"
            : "border-border hover:border-border-strong hover:bg-surface",
        )}
      >
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-full border transition-colors",
            value === true
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border-strong text-muted-foreground",
          )}
        >
          <Check className="size-4.5" strokeWidth={2.2} />
        </span>
        Yes
        <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-faint-foreground">
          Press Y
        </span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAnswer(false)}
        className={cn(
          "ownership-flow-option flex flex-col items-center gap-2 rounded-card border bg-card px-4 py-6 text-[15px] font-semibold text-foreground transition-colors",
          value === false
            ? "border-border-strong bg-surface ring-1 ring-border-strong/40"
            : "border-border hover:border-border-strong hover:bg-surface",
        )}
      >
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-full border transition-colors",
            value === false
              ? "border-border-strong bg-border-strong/20 text-secondary-foreground"
              : "border-border-strong text-muted-foreground",
          )}
        >
          <X className="size-4.5" strokeWidth={2.2} />
        </span>
        Not really
        <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-faint-foreground">
          Press N
        </span>
      </button>
    </div>
  );
}

interface OptionGridProps {
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: readonly string[];
  onToggle: (value: string) => void;
  /** Selecting past this count disables the rest (pick-N screens). */
  max?: number;
  disabled?: boolean;
  columns?: 1 | 2;
}

/** Tap-target grid used by single-select, pick-N, and open multi screens. */
export function OptionGrid({
  options,
  selected,
  onToggle,
  max,
  disabled,
  columns = 2,
}: OptionGridProps) {
  const limitReached = typeof max === "number" && selected.length >= max;
  return (
    <div className={cn("grid gap-2.5 text-left", columns === 2 && "sm:grid-cols-2")}>
      {options.map((option, index) => {
        const isSelected = selected.includes(option.value);
        const isDisabled = disabled || (!isSelected && limitReached);
        return (
          <button
            key={option.value}
            type="button"
            disabled={isDisabled}
            onClick={() => onToggle(option.value)}
            className={cn(
              "ownership-flow-option flex items-center gap-3 rounded-control border bg-card px-3.5 py-3.5 text-[13.5px] font-medium text-foreground transition-colors",
              isSelected
                ? "border-primary bg-primary-soft ring-1 ring-primary/20"
                : "border-border hover:border-border-strong hover:bg-surface",
              isDisabled && !isSelected && "cursor-not-allowed opacity-45 hover:border-border hover:bg-card",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-[6px] border text-[11px] font-bold transition-colors",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border-strong text-muted-foreground",
              )}
            >
              {isSelected ? <Check className="size-3.5" strokeWidth={2.4} /> : index + 1}
            </span>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface SliderScreenBodyProps {
  value: number;
  onChange: (value: number) => void;
  onConfirm: () => void;
}

/** The one non-tap screen: the hands-on ↔ executive slider plus a confirm. */
export function SliderScreenBody({ value, onChange, onConfirm }: SliderScreenBodyProps) {
  return (
    <div>
      <div className="rounded-card border border-border-soft bg-surface px-6 py-8 sm:px-9">
        <Slider
          value={[value]}
          onValueChange={([next]) => onChange(next)}
          min={0}
          max={100}
          step={5}
        />
        <div className="mt-4 flex items-start justify-between text-[12.5px] font-medium text-muted-foreground">
          <span className="max-w-[9rem] text-left leading-snug">Hands-on Owner</span>
          <span className="max-w-[9rem] text-right leading-snug">Executive Owner</span>
        </div>
        <p className="mt-6 text-[14px] font-semibold text-primary" aria-live="polite">
          {ownershipStyleLabel(value)}
        </p>
      </div>
      <Button type="button" size="lg" onClick={onConfirm} className="mt-6 w-full sm:w-auto">
        That&rsquo;s my style
      </Button>
    </div>
  );
}
