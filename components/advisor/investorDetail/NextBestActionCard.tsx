import { Calendar, CalendarCheck2, CheckCircle2, ClipboardCheck, FileText, PlayCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { NextBestAction } from "@/lib/advisor/nextBestAction";

const ICONS = {
  calendar: Calendar,
  video: PlayCircle,
  fdd: FileText,
  review: ClipboardCheck,
  consultation: CalendarCheck2,
  none: CheckCircle2,
} as const;

export function NextBestActionCard({ action, email }: { action: NextBestAction; email: string }) {
  const Icon = ICONS[action.icon];
  const mailtoHref = action.reminder
    ? `mailto:${email}?subject=${encodeURIComponent(action.reminder.subject)}&body=${encodeURIComponent(action.reminder.body)}`
    : null;

  return (
    <Card className="border-success/25 bg-success-soft">
      <CardContent className="p-5">
        <p className="text-sm font-semibold text-foreground">Next Best Action</p>
        <div className="mt-3 flex items-start gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
            <Icon className="size-5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="font-serif text-lg font-semibold text-foreground">{action.title}</p>
            <p className="mt-1 text-sm text-secondary-foreground">{action.description}</p>
            {mailtoHref && (
              <Button asChild size="sm" className="mt-3 bg-success text-white hover:bg-success/90">
                <a href={mailtoHref}>Send Reminder</a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
