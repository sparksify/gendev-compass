import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  ClipboardCheck,
  Clock,
  FileText,
  PlayCircle,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Icon + color per suggestNextAction() output (lib/advisor/nextAction.ts).
 * Any label not listed here (there shouldn't be any, but suggestNextAction
 * returns a plain string) falls back to a neutral pill rather than crashing. */
const ACTION_STYLES: Record<string, { icon: React.ComponentType<{ className?: string }>; className: string }> = {
  "Await portal activity": { icon: Clock, className: "bg-primary-soft text-primary" },
  "Monitor engagement": { icon: TrendingUp, className: "bg-success-soft text-success" },
  "Prepare for consultation": { icon: CalendarClock, className: "bg-[#fef3c7] text-[#92400e]" },
  "Schedule follow-up": { icon: Calendar, className: "bg-[#fef3c7] text-[#92400e]" },
  "Rebook cancelled consultation": { icon: Calendar, className: "bg-[#fef3c7] text-[#92400e]" },
  "Follow up on FDD": { icon: FileText, className: "bg-[#ede9fe] text-[#5b21b6]" },
  "Begin due diligence discussion": { icon: FileText, className: "bg-[#ede9fe] text-[#5b21b6]" },
  "Discuss the franchise agreement": { icon: FileText, className: "bg-success-soft text-success" },
  "Resolve FDD delivery error": { icon: AlertTriangle, className: "bg-[#fee2e2] text-destructive" },
  "Review outcome and update stage": { icon: ClipboardCheck, className: "bg-primary-soft text-primary" },
  "Encourage questionnaire completion": { icon: PlayCircle, className: "bg-primary-soft text-primary" },
};

/** Compact colored status pill for the client list's Next Action column. */
export function NextActionPill({ action }: { action: string }) {
  if (action === "—") return <span className="text-muted-foreground">—</span>;
  const style = ACTION_STYLES[action] ?? { icon: ClipboardCheck, className: "bg-surface text-muted-foreground" };
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-control px-2.5 py-1 text-xs font-medium",
        style.className,
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      {action}
    </span>
  );
}
