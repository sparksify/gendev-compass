import Link from "next/link";
import { ArrowRight, BookOpen, ClipboardCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PathChooserProps {
  token: string;
  /** True once the prospect has started the investor overview. */
  videoStarted: boolean;
  videoPercent: number;
}

/**
 * The landing hero for prospects who haven't chosen a route yet: two equal
 * paths — the educational journey or a fast track straight to qualification.
 */
export function PathChooser({ token, videoStarted, videoPercent }: PathChooserProps) {
  const base = `/p/${token}`;

  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <h2 className="text-[15.5px] font-bold text-foreground">Choose Your Path</h2>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-[1.6] text-muted-foreground">
          Whether you&apos;re just beginning your research or already have experience evaluating
          franchise opportunities, choose the experience that best fits where you are today.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col rounded-card border border-border p-4">
            <span className="flex size-9 items-center justify-center rounded-control border border-primary-soft-border bg-primary-soft text-primary">
              <BookOpen className="size-[17px]" strokeWidth={1.7} />
            </span>
            <h3 className="mt-3.5 text-[14.5px] font-bold text-foreground">
              Learn About the Opportunity
            </h3>
            <p className="mt-1.5 text-[13px] leading-[1.6] text-muted-foreground">
              Explore the business model, investment process, and resources designed to help you
              evaluate whether this opportunity is right for you.
            </p>
            <div className="mt-auto pt-4">
              <Button asChild variant="outline" className="w-full">
                <Link href={`${base}/overview`}>
                  Continue Learning <ArrowRight />
                </Link>
              </Button>
              <p className="mt-2 min-h-[17px] text-center text-[11.5px] text-muted-foreground">
                {videoStarted ? `Resume the investor overview at ${videoPercent}%` : " "}
              </p>
            </div>
          </div>

          <div className="flex flex-col rounded-card border border-border p-4">
            <span className="flex size-9 items-center justify-center rounded-control border border-primary-soft-border bg-primary-soft text-primary">
              <ClipboardCheck className="size-[17px]" strokeWidth={1.7} />
            </span>
            <h3 className="mt-3.5 text-[14.5px] font-bold text-foreground">
              Fast Track for Experienced Investors
            </h3>
            <p className="mt-1.5 text-[13px] leading-[1.6] text-muted-foreground">
              Already familiar with franchise investing or experienced in evaluating investment
              opportunities? Move directly into our qualification process so your advisor can
              prepare for a productive consultation.
            </p>
            <div className="mt-auto pt-4">
              <Button asChild variant="secondary" className="w-full">
                <Link href={`${base}/questionnaire`}>
                  Begin Qualification <ArrowRight />
                </Link>
              </Button>
              <p className="mt-2 min-h-[17px] text-center text-[11.5px] text-muted-foreground">
                Takes about 3–5 minutes
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
