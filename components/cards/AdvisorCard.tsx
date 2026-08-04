import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Lock, Mail, Phone } from "lucide-react";
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
      <CardContent>
        <h2 className="text-[15.5px] font-bold text-foreground">Your Advisor</h2>

        <div className="mt-4 flex gap-4">
          <Image
            src={brand.advisorPhotoPath}
            alt={`${brand.advisorName}, your advisor`}
            width={84}
            height={84}
            className="size-[84px] shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0">
            <p className="font-serif text-[21px] leading-[1.2] text-foreground">
              {brand.advisorName}
            </p>
            <p className="mt-[3px] text-[12.5px] text-secondary-foreground">{brand.advisorTitle}</p>
            <p className="mt-2.5 text-[12.5px] leading-[1.55] text-muted-foreground">
              Your primary point of contact throughout the qualification process.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-border-soft pt-3.5">
          <p className="flex items-center gap-[9px] text-[12.5px] text-secondary-foreground">
            <Phone className="size-[15px] shrink-0 text-faint-foreground" strokeWidth={1.6} />
            {brand.advisorPhone}
          </p>
          <p className="flex items-center gap-[9px] text-[12.5px]">
            <Mail className="size-[15px] shrink-0 text-faint-foreground" strokeWidth={1.6} />
            <a
              href={`mailto:${brand.advisorEmail}`}
              className="text-primary hover:text-primary-hover"
            >
              {brand.advisorEmail}
            </a>
          </p>
        </div>

        {booked ? (
          <Button asChild variant="secondary" className="mt-[18px] w-full">
            <Link href={`/p/${token}/complete`}>
              <CalendarDays /> View Consultation Details
            </Link>
          </Button>
        ) : scheduleUnlocked ? (
          <Button asChild className="mt-[18px] w-full">
            <Link href={`/p/${token}/schedule`}>
              <CalendarDays /> Schedule Consultation
            </Link>
          </Button>
        ) : (
          <div>
            <Button variant="locked" size="lg" className="mt-[18px] w-full" disabled>
              <Lock className="size-3.5" strokeWidth={1.9} /> Schedule Consultation
            </Button>
            <p className="mt-3 text-center text-[12.5px] text-muted-foreground">
              Complete the questionnaire to unlock
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
