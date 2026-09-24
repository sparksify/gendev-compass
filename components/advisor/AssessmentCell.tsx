import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { formatRelative } from "@/lib/advisor/format";
import type { BridgeAssessmentRecord } from "@/lib/bridge/assessmentRecord";

/**
 * The clients-table cell for the bridge-page fit assessment: a green check
 * with the fit call and when it was submitted, linking to the answers on
 * the client's page. Reads "—" for anyone who hasn't taken it.
 */
export function AssessmentCell({
  assessment,
  leadId,
}: {
  assessment: BridgeAssessmentRecord | null;
  leadId: string;
}) {
  if (!assessment) {
    return <span className="text-[12.5px] text-ghost-foreground">—</span>;
  }
  const strong = assessment.fit === "strong";
  return (
    <Link
      href={`/advisor/investors/${leadId}#fit-assessment`}
      className="group flex min-w-0 flex-col gap-0.5"
      title="Open the fit assessment answers"
    >
      <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-success group-hover:underline">
        <CheckCircle2 className="size-[14px] shrink-0" strokeWidth={2.2} />
        {strong ? "Strong fit" : "Standard fit"}
      </span>
      <span className="text-[11px] font-medium text-faint-foreground">
        {formatRelative(assessment.submittedAt)}
      </span>
    </Link>
  );
}
