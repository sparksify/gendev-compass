"use client";

import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CompleteJourneyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationLabel: string | null;
  nextStepLabel: string;
  nextStepHref: string;
}

/**
 * Shown instead of ReviewRequestModal when a prospect asks for a territory
 * review before they've completed their qualification profile. The tool is
 * meant to draw them further into the investment journey (watch the
 * overview, then the questionnaire), not just collect a review request in
 * isolation — so a review request no longer submits until that profile
 * exists. Which step it points to depends on where they already are (video
 * done vs. not), resolved server-side from the same resumeRoute logic the
 * rest of the portal uses (lib/portal/getPortalState.ts).
 */
export function CompleteJourneyModal({
  open,
  onOpenChange,
  locationLabel,
  nextStepLabel,
  nextStepHref,
}: CompleteJourneyModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-1 flex size-9 items-center justify-center rounded-full bg-primary-soft">
            <GraduationCap className="size-4.5 text-primary" strokeWidth={1.8} />
          </div>
          <DialogTitle>Let&apos;s Finish Your Profile First</DialogTitle>
          <DialogDescription>
            Before the GenDev team reviews{" "}
            {locationLabel ? <strong className="text-foreground">{locationLabel}</strong> : "this market"} with
            you, complete <strong className="text-foreground">{nextStepLabel}</strong> — it helps them prepare a
            review tailored to you and speeds up their response.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button asChild>
            <Link href={nextStepHref}>
              {nextStepLabel} <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
