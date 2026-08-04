import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/config/brand";

interface AdvisorCardProps {
  token: string;
  /** True once qualification has unlocked the calendar. */
  scheduleUnlocked: boolean;
  booked: boolean;
}

export function AdvisorCard({ token, scheduleUnlocked, booked }: AdvisorCardProps) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Your Advisor</h2>
        <div className="flex items-center gap-4">
          <Image
            src={brand.advisorPhotoPath}
            alt={`${brand.advisorName}, your advisor`}
            width={72}
            height={72}
            className="rounded-xl border border-border object-cover"
          />
          <div>
            <p className="font-serif text-xl font-semibold text-foreground">{brand.advisorName}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">Senior Investment Advisor</p>
          </div>
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Your primary point of contact throughout the qualification process.
        </p>
        {booked ? (
          <Button asChild variant="secondary" className="w-full">
            <Link href={`/p/${token}/complete`}>
              <CalendarDays /> View Consultation Details
            </Link>
          </Button>
        ) : scheduleUnlocked ? (
          <Button asChild className="w-full">
            <Link href={`/p/${token}/schedule`}>
              <CalendarDays /> Schedule Consultation
            </Link>
          </Button>
        ) : (
          <div>
            <Button variant="locked" className="w-full" disabled>
              <Lock /> Schedule Consultation
            </Button>
            <p className="mt-2.5 text-center text-xs text-muted-foreground">
              Complete the questionnaire to unlock
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
