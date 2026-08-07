import { CheckboxCardGroup } from "@/components/ui/checkbox-card";

interface MultiSelectStepProps {
  prompt: string;
  helper?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: readonly string[];
  onChange: (values: string[]) => void;
  max?: number;
  columns?: 1 | 2 | 3;
}

/**
 * Shared step body for every checkbox-card section of the Ownership
 * Profile (motivations, activities, environment, priorities, experience).
 * One control, reused with different option sets — see
 * types/ownershipProfile.ts for each section's options and OwnershipProfileAssessment
 * for how steps are wired together.
 */
export function MultiSelectStep({
  prompt,
  helper,
  options,
  selected,
  onChange,
  max,
  columns = 2,
}: MultiSelectStepProps) {
  return (
    <div>
      <h2 className="font-serif text-[22px] font-normal leading-[1.25] text-foreground sm:text-[25px]">
        {prompt}
      </h2>
      {(helper || max) && (
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {helper}
          {max && (
            <span className="ml-1 font-medium text-primary">
              Choose up to {max}
              {selected.length > 0 ? ` (${selected.length} selected)` : ""}.
            </span>
          )}
        </p>
      )}
      <div className="mt-6">
        <CheckboxCardGroup
          aria-label={prompt}
          options={options}
          selected={selected}
          onChange={onChange}
          max={max}
          columns={columns}
        />
      </div>
    </div>
  );
}
