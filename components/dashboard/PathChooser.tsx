import Link from "next/link";
import { ArrowRight, BookOpen, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { brand } from "@/lib/config/brand";

interface PathChooserProps {
  token: string;
  /** True once the prospect has started the investor overview. */
  videoStarted: boolean;
  videoPercent: number;
}

/**
 * The two ways to move forward, shown alongside the Current Status hero
 * while the prospect hasn't yet completed the overview or questionnaire.
 * One path is visually recommended; the other is a clearly secondary
 * shortcut — never equal weight, so there's one obvious next action.
 */
export function PathChooser({ token, videoStarted, videoPercent }: PathChooserProps) {
  const base = `/p/${token}`;
  const overviewCtaLabel = videoStarted ? "Resume Overview" : "Begin Overview";

  return (
    <div className="grid gap-[18px] lg:grid-cols-2">
      <Card className="overflow-visible border-accent-gold/40">
        <CardContent className="flex h-full flex-col p-6 sm:p-7">
          <Badge
            variant="primary"
            className="w-fit bg-accent-gold-soft px-3 py-1 uppercase tracking-[0.04em] text-accent-gold shadow-card"
          >
            Recommended
          </Badge>

          <h2 className="mt-4 font-serif text-2xl font-normal text-foreground">The Guided Path</h2>
          <p className="mt-1 text-[13px] font-medium text-muted-foreground">
            For a complete understanding
          </p>
          <p className="mt-3 text-[13px] leading-[1.6] text-muted-foreground">
            Continue your overview of the business model, investment requirements, and what it
            means to own a {brand.brandName} business.
          </p>

          <div className="mt-auto pt-5">
            <div className="rounded-control border border-border bg-surface p-3.5">
              <div className="flex items-center gap-2.5">
                <BookOpen className="size-4 shrink-0 text-sidebar" strokeWidth={1.8} />
                <span className="flex-1 text-[13px] font-semibold text-foreground">
                  Investor Overview
                </span>
                <span className="text-[12px] text-muted-foreground">
                  {videoStarted ? `${videoPercent}% complete` : "Not started"}
                </span>
              </div>
              <Progress
                value={videoStarted ? videoPercent : 0}
                className="mt-2.5"
                indicatorClassName="bg-sidebar"
                aria-label="Overview progress"
              />
            </div>

            <Button
              asChild
              size="lg"
              className="mt-4 w-full justify-between bg-sidebar text-white hover:bg-sidebar/90"
            >
              <Link href={`${base}/overview`}>
                {overviewCtaLabel}
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-transparent bg-sidebar">
        <CardContent className="flex h-full flex-col p-6 sm:p-7">
          <h2 className="font-serif text-2xl font-normal text-white">The Fast Lane</h2>
          <p className="mt-1 text-[13px] font-medium text-accent-gold">
            For experienced investors
          </p>
          <p className="mt-3 text-[13px] leading-[1.6] text-sidebar-foreground/70">
            Skip ahead to key data, financials, and resources to accelerate your evaluation.
          </p>

          <div className="mt-auto pt-5">
            <div className="flex items-center gap-3 rounded-control border border-white/10 bg-white/5 p-3.5">
              <Lock className="size-4 shrink-0 text-sidebar-foreground/60" strokeWidth={1.8} />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white">Data Room Access</p>
                <p className="text-[12px] text-sidebar-foreground/60">
                  Unlock after completing Step 2
                </p>
              </div>
            </div>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="mt-4 w-full justify-between border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <Link href={`${base}/questionnaire`}>
                Skip to Data Room
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
