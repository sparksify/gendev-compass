import { cn } from "@/lib/utils";

/** Solid green check circle from the comp (filled disc, white check). */
export function CheckCircleSolid({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cn("size-[19px]", className)}>
      <circle cx="12" cy="12" r="10" fill="var(--success)" />
      <path
        d="m7.5 12.3 3 3 6-6.6"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
