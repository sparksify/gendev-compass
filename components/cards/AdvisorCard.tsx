import Link from "next/link";
import { ArrowRight, CalendarDays, Check, Mail, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/config/brand";
import type { PortalState } from "@/types/portal";

const CONSULTATION_EXPECTATIONS = [
  "Personalized guidance",
  "Direct answers",
  "Professional consultation",
  "No-pressure discussion",
];

/**
 * Meet Your Advisor — communicates why the consultation is valuable and
 * routes the prospect to the state-appropriate next step.
 */
export function AdvisorCard({
  token,
  state,
  photoUrl,
}: {
  token: string;
  state: PortalState;
  photoUrl?: string;
}) {
  const base = `/p/${token}`;

  return (
    <Card>
      <CardContent>
        <h2 className="text-[15.5px] font-bold text-foreground">Meet Your Advisor</h2>

        <div className="mt-4 flex gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded asset */}
          <img
            src={photoUrl ?? brand.advisorPhotoPath}
            alt={`${brand.advisorName}, your advisor`}
            className="size-[84px] shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0">
            <p className="font-serif text-[21px] leading-[1.2] text-foreground">
              {brand.advisorName}
            </p>
            <p className="mt-[3px] text-[12.5px] text-secondary-foreground">{brand.advisorTitle}</p>
          </div>
        </div>

        <p className="mt-4 text-[12.5px] leading-[1.6] text-muted-foreground">
          {brand.advisorName} will help you evaluate whether this opportunity aligns with your
          investment goals. Expect:
        </p>
        <ul className="mt-2.5 space-y-1.5">
          {CONSULTATION_EXPECTATIONS.map((item) => (
            <li
              key={item}
              className="flex items-center gap-2 text-[12.5px] text-secondary-foreground"
            >
              <Check className="size-3.5 shrink-0 text-success" strokeWidth={2.5} />
              {item}
            </li>
          ))}
        </ul>

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

        {state.booked ? (
          <Button asChild variant="secondary" className="mt-[18px] w-full">
            <Link href={`${base}/complete`}>
              <CalendarDays /> View Consultation Details
            </Link>
          </Button>
        ) : state.qualified ? (
          <Button asChild className="mt-[18px] w-full">
            <Link href={`${base}/schedule`}>
              <CalendarDays /> Schedule Consultation
            </Link>
          </Button>
        ) : state.reviewRequired ? (
          <p className="mt-[18px] rounded-control bg-surface px-4 py-3 text-center text-[12.5px] text-muted-foreground">
            {brand.advisorName} is reviewing your investor profile and will reach out directly.
          </p>
        ) : (
          <div>
            <Button asChild className="mt-[18px] w-full">
              <Link href={`${base}/questionnaire`}>
                Begin Qualification <ArrowRight />
              </Link>
            </Button>
            <p className="mt-2.5 text-center text-xs text-muted-foreground">
              A few questions help {brand.advisorName} prepare for your consultation
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
