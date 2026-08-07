import { cn } from "@/lib/utils";

interface SingleSelectStepProps {
  prompt: string;
  helper?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string | null;
  onChange: (value: string) => void;
  columns?: 1 | 2;
}

/**
 * Shared step body for the two single-select sections (growth comfort,
 * timeline) — a generic sibling of components/forms/RadioCardGroup, which
 * stays react-hook-form-bound for the existing questionnaire and isn't
 * reused here since this assessment persists locally, not via a form submit.
 */
export function SingleSelectStep({
  prompt,
  helper,
  options,
  value,
  onChange,
  columns = 1,
}: SingleSelectStepProps) {
  return (
    <div>
      <h2 className="font-serif text-[22px] font-normal leading-[1.25] text-foreground sm:text-[25px]">
        {prompt}
      </h2>
      {helper && (
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{helper}</p>
      )}
      <div
        role="radiogroup"
        aria-label={prompt}
        className={cn("mt-6 grid gap-2.5", columns === 2 && "sm:grid-cols-2")}
      >
        {options.map((option) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-control border border-border bg-card px-3.5 py-3 text-[13.5px] text-foreground transition-colors hover:border-border-strong",
                checked && "border-primary bg-primary-soft ring-1 ring-primary/15",
              )}
            >
              <input
                type="radio"
                checked={checked}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  "relative flex size-4 shrink-0 items-center justify-center rounded-full border border-border-strong transition-colors after:block after:size-1.5 after:rounded-full after:bg-card after:opacity-0 after:transition-opacity",
                  checked && "border-primary bg-primary after:opacity-100",
                )}
              />
              <span className="font-medium">{option.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
