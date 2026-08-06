import Link from "next/link";
import { ArrowRight, BookOpen, Clock, Play, Rocket } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { VIDEO_ESTIMATED_MINUTES } from "@/lib/config/content";

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

  return (
    <div className="grid gap-[18px] lg:grid-cols-2">
      <Card className="relative overflow-visible border-primary/30">
        <span className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge
            variant="primary"
            className="bg-primary px-3 py-1 uppercase tracking-[0.04em] text-primary-foreground shadow-card"
          >
            Recommended
          </Badge>
        </span>

        <CardContent className="flex h-full flex-col p-6 pt-7 sm:p-7 sm:pt-8">
          <span className="flex size-9 items-center justify-center rounded-control border border-primary-soft-border bg-primary-soft text-primary">
            <BookOpen className="size-[17px]" strokeWidth={1.7} />
          </span>
          <h2 className="mt-3.5 text-[15.5px] font-bold text-foreground">
            Learn About the Opportunity
          </h2>
          <p className="mt-1.5 text-[13px] leading-[1.6] text-muted-foreground">
            Start with a guided overview of the business model, investment process, and ownership
            expectations before moving into qualification.
          </p>
          <p className="mt-2 text-[12.5px] font-semibold text-primary">Most investors start here.</p>

          <div className="mt-auto pt-5">
            <Button asChild variant="outline" size="lg" className="w-full">
              <Link href={`${base}/overview`}>
                <Play strokeWidth={1.8} /> Continue Investor Overview <ArrowRight />
              </Link>
            </Button>

            {videoStarted && (
              <div className="mt-3">
                <div className="flex items-baseline justify-between text-[11.5px] text-muted-foreground">
                  <span>Resume where you left off</span>
                  <span className="font-semibold text-foreground">{videoPercent}% complete</span>
                </div>
                <Progress value={videoPercent} className="mt-1.5" aria-label="Overview progress" />
              </div>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <Clock className="size-3.5" strokeWidth={1.8} />
              About {VIDEO_ESTIMATED_MINUTES} minutes
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex h-full flex-col p-6 sm:p-7">
          <span className="flex size-9 items-center justify-center rounded-control border border-border bg-surface text-muted-foreground">
            <Rocket className="size-[17px]" strokeWidth={1.7} />
          </span>
          <h2 className="mt-3.5 text-[15.5px] font-bold text-foreground">
            Fast Track for Experienced Investors
          </h2>
          <p className="mt-1.5 text-[13px] leading-[1.6] text-muted-foreground">
            Already familiar with franchise investing or have evaluated similar opportunities?
            Skip directly to the qualification questionnaire.
          </p>
          <p className="mt-2 text-[12.5px] font-semibold text-primary">For experienced investors.</p>

          <div className="mt-auto pt-5">
            <Button asChild variant="secondary" size="lg" className="w-full">
              <Link href={`${base}/questionnaire`}>Skip to Qualification</Link>
            </Button>
            <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <Clock className="size-3.5" strokeWidth={1.8} />
              Takes about 3–5 minutes
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
