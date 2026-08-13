import {
  Calendar,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Phone,
  PlayCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { NextBestAction } from "@/lib/advisor/nextBestAction";

const ICONS = {
  calendar: Calendar,
  video: PlayCircle,
  fdd: FileText,
  review: ClipboardCheck,
  consultation: CalendarCheck2,
  contact: Phone,
  none: CheckCircle2,
} as const;

/**
 * A normal white card — only the icon chip and the CTA carry color, per the
 * "calm, not loud" direction. The full-width amber follow-up banner this
 * page used to show lives here as prose instead (see `action.description`),
 * so the advisor isn't told the same thing twice in two places.
 */
export function NextBestActionCard({ action, email }: { action: NextBestAction; email: string }) {
  const Icon = ICONS[action.icon];
  const mailtoHref = action.reminder
    ? `mailto:${email}?subject=${encodeURIComponent(action.reminder.subject)}&body=${encodeURIComponent(action.reminder.body)}`
    : null;

  return (
    <Card className="h-full rounded-2xl">
      <CardContent className="p-6">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-success" aria-hidden />
          <p className="text-sm font-semibold text-foreground">Next Best Action</p>
        </div>
        <div className="mt-4 flex items-start gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
            <Icon className="size-5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="font-serif text-xl font-semibold text-foreground">{action.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-secondary-foreground">{action.description}</p>
            {action.whyItMatters && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium">Why this matters —</span> {action.whyItMatters}
              </p>
            )}
            {mailtoHref && (
              <Button asChild size="sm" className="mt-4 bg-success text-white hover:bg-success/90">
                <a href={mailtoHref}>{action.ctaLabel}</a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
