import { Badge } from "@/components/ui/badge";
import type { FollowUpResult } from "@/lib/advisor/followUp";

export function FollowUpBadge({ followUp }: { followUp: FollowUpResult }) {
  if (!followUp.needed) return null;
  return (
    <Badge className="bg-[#fef3c7] text-[#92400e]" title={followUp.reasons.join("\n")}>
      Needs follow-up
    </Badge>
  );
}
