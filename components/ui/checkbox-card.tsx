"use client";

import { cn } from "@/lib/utils";

interface CheckboxCardGroupProps {
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: readonly string[];
  onChange: (values: string[]) => void;
  /** When set, selecting past this count disables the remaining options. */
  max?: number;
  /** Two or three-up on wider screens when there's room. */
  columns?: 1 | 2 | 3;
  "aria-label"?: string;
}

/**
 * Multi-select counterpart to RadioCardGroup: real checkbox inputs styled as
 * selectable cards. Not bound to react-hook-form — the Ownership Profile
 * assessment is locally persisted, not a validated form submission.
 */
export function CheckboxCardGroup({
  options,
  selected,
  onChange,
  max,
  columns = 1,
  "aria-label": ariaLabel,
}: CheckboxCardGroupProps) {
  const limitReached = typeof max === "number" && selected.length >= max;

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
      return;
    }
    if (limitReached) return;
    onChange([...selected, value]);
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "grid gap-2.5",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {options.map((option) => {
        const checked = selected.includes(option.value);
        const disabled = !checked && limitReached;
        return (
          <label
            key={option.value}
            className={cn(
              "flex items-center gap-3 rounded-control border border-border bg-card px-3.5 py-3 text-[13.5px] text-foreground transition-colors",
              checked && "border-primary bg-primary-soft ring-1 ring-primary/15",
              disabled
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer hover:border-border-strong",
            )}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => toggle(option.value)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={cn(
                "relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-border-strong transition-colors",
                checked && "border-primary bg-primary",
              )}
            >
              {checked && (
                <svg viewBox="0 0 12 12" className="size-2.5 text-primary-foreground" fill="none">
                  <path
                    d="M2.5 6.2 5 8.7 9.5 3.3"
                    stroke="currentColor"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            <span className="font-medium">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}
