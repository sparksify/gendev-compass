import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  OWNERSHIP_PROFILE_SECTION_COUNT,
  activityLabels,
  environmentLabels,
  experienceLabels,
  growthComfortLabel,
  motivationLabels,
  ownershipStyleLabel,
  priorityLabels,
  timelineLabel,
  toOwnershipProfileInput,
  type OwnershipProfileDbRecord,
} from "@/types/ownershipProfile";

/**
 * The investor's own account of what they want from ownership. Self-reported
 * and deliberately not scored — it is conversation preparation, not
 * qualification, and is shown separately from the Qualification Overview so
 * the two are never mistaken for each other.
 *
 * Rendered for partial profiles too: someone who answered five of eight
 * sections and stopped is still worth reading, and the progress count says
 * how much to trust the picture.
 */

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[13.5px] leading-[1.45] font-medium uppercase tracking-wide text-faint-foreground">{label}</p>
      <div className="mt-0.5 text-[15.5px] leading-[1.45] text-foreground">{value}</div>
    </div>
  );
}

function list(labels: string[]): string | null {
  return labels.length > 0 ? labels.join(" · ") : null;
}

export function OwnershipProfileCard({
  profile,
}: {
  profile: OwnershipProfileDbRecord | null;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Ownership Profile</CardTitle>
        {profile ? (
          profile.completed_at ? (
            <Badge variant="success">Complete</Badge>
          ) : (
            <Badge variant="neutral">
              {profile.answered_sections}/{OWNERSHIP_PROFILE_SECTION_COUNT} sections
            </Badge>
          )
        ) : null}
      </CardHeader>
      <CardContent>
        {profile ? (
          <div className="space-y-3">
            <Row label="Ownership style" value={ownershipStyleLabel(profile.ownership_style)} />
            <Row label="Timeline" value={timelineLabel(toOwnershipProfileInput(profile))} />
            <Row
              label="Growth comfort"
              value={growthComfortLabel(toOwnershipProfileInput(profile))}
            />
            <Row label="Motivations" value={list(motivationLabels(toOwnershipProfileInput(profile)))} />
            <Row label="Priorities" value={list(priorityLabels(toOwnershipProfileInput(profile)))} />
            <Row label="Enjoys doing" value={list(activityLabels(toOwnershipProfileInput(profile)))} />
            <Row
              label="Industries of interest"
              value={list(environmentLabels(toOwnershipProfileInput(profile)))}
            />
            <Row label="Background" value={list(experienceLabels(toOwnershipProfileInput(profile)))} />
          </div>
        ) : (
          <p className="text-[15.5px] leading-[1.45] text-muted-foreground">Ownership Profile not started yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
