"use client";

import { ArrowRight } from "lucide-react";

/**
 * The one call to action under the video. Never gated on the video: it
 * scrolls to the assessment for anyone who already wants to move forward.
 * Plain anchor underneath, so it still works without JavaScript.
 */
export function ScrollToAssessment() {
  return (
    <a
      href="#assessment"
      onClick={(event) => {
        const target = document.getElementById("assessment");
        if (!target) return;
        event.preventDefault();
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        window.history.replaceState(null, "", "#assessment");
      }}
      className="inline-flex h-[50px] items-center gap-2.5 rounded-[7px] bg-sidebar px-7 text-[13px] font-semibold uppercase tracking-[0.08em] text-white shadow-[0_1px_2px_rgb(16_24_40/0.08)] transition-colors hover:bg-sidebar/90"
    >
      See If CMDT Fits Me <ArrowRight className="size-4" strokeWidth={2} />
    </a>
  );
}
