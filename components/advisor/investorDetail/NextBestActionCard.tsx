import {
  Calendar,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Mail,
  Phone,
  PlayCircle,
  PlusCircle,
} from "lucide-react";
import { MoreActionsMenu } from "./MoreActionsMenu";
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
 * The one deliberately-colored panel on the page — a soft green gradient
 * with a white medallion, per the handoff. Everything else stays a plain
 * white card so this reads as "the thing to do next" at a glance.
 */
export function NextBestActionCard({
  action,
  email,
  portalUrl,
}: {
  action: NextBestAction;
  email: string;
  portalUrl: string;
}) {
  const Icon = ICONS[action.icon];
  const mailtoHref = action.reminder
    ? `mailto:${email}?subject=${encodeURIComponent(action.reminder.subject)}&body=${encodeURIComponent(action.reminder.body)}`
    : null;

  return (
    <div className="rounded-card border border-[#cfebd8] bg-gradient-to-br from-[#f2faf5] via-[#f7fcf9] to-[#fbfdfc] px-[15px] py-3.5 shadow-card">
      <div className="flex flex-wrap items-start gap-3.5">
        <span className="flex size-[60px] shrink-0 items-center justify-center rounded-full border border-[#cfebd8] bg-card text-[#15803d]">
          <Icon className="size-[25px]" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.09em] text-[#15803d]">
            <PlusCircle className="size-[13px]" />
            Next best action
          </p>
          <p className="mt-1 font-serif text-lg font-semibold leading-tight text-foreground">
            {action.title}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
          <div className="mt-[11px] flex flex-wrap items-center gap-2">
            {mailtoHref && (
              <a
                href={mailtoHref}
                className="inline-flex items-center gap-1.5 rounded-control bg-success px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#15803d]"
              >
                <Mail className="size-3.5" />
                {action.ctaLabel}
              </a>
            )}
            <MoreActionsMenu portalUrl={portalUrl} />
          </div>
        </div>
      </div>
    </div>
  );
}
