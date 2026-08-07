import { Slider } from "@/components/ui/slider";
import { ownershipStyleLabel } from "@/types/ownershipProfile";

interface OwnershipStyleStepProps {
  value: number;
  onChange: (value: number) => void;
}

/** Section 3 — a single slider from hands-on to executive ownership. */
export function OwnershipStyleStep({ value, onChange }: OwnershipStyleStepProps) {
  return (
    <div>
      <h2 className="font-serif text-[22px] font-normal leading-[1.25] text-foreground sm:text-[25px]">
        What&rsquo;s your preferred ownership style?
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
        Move the slider toward how involved you want to be in day-to-day operations.
      </p>

      <div className="mt-10 rounded-control border border-border-soft bg-surface px-6 py-8 sm:px-9">
        <Slider
          value={[value]}
          onValueChange={([next]) => onChange(next)}
          min={0}
          max={100}
          step={5}
        />
        <div className="mt-4 flex items-start justify-between text-[12.5px] font-medium text-muted-foreground">
          <span className="max-w-[9rem] leading-snug">Hands-on Owner</span>
          <span className="max-w-[9rem] text-right leading-snug">Executive Owner</span>
        </div>
        <p className="mt-6 text-center text-[13.5px] font-semibold text-primary">
          {ownershipStyleLabel(value)}
        </p>
      </div>
    </div>
  );
}
