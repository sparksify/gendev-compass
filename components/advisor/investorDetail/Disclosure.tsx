"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A single, consistent expand/collapse control used across the client
 * detail page's compact cards (Funding Profile, Consultations, FDD Status,
 * Video Engagement, Location & Territory) — replaces scattered native
 * <details>/<summary> markers with one chevron-driven pattern.
 */
export function Disclosure({
  summary,
  children,
  className,
  defaultOpen = false,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-primary hover:underline"
      >
        <span>{summary}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="mt-2.5">{children}</div>}
    </div>
  );
}
