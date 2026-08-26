import { cn } from "@/lib/utils";

/** Deterministic palette so the same name always gets the same color. */
const PALETTE = [
  "bg-[#2563eb] text-white",
  "bg-[#7c3aed] text-white",
  "bg-[#0d9488] text-white",
  "bg-[#c2410c] text-white",
  "bg-[#be185d] text-white",
  "bg-[#4338ca] text-white",
];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function InitialsAvatar({
  name,
  size = "lg",
  className,
}: {
  name: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        size === "lg" ? "size-14 text-[19.5px] leading-[1.4]" : "size-6 text-[11.5px]",
        colorFor(name || "?"),
        className,
      )}
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}
