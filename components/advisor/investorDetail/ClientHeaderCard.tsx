import { Mail, Phone, Share2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AdvisorAssignmentControl } from "./AdvisorAssignmentControl";
import { StageStatusControl } from "./StageStatusControl";
import { InitialsAvatar } from "./InitialsAvatar";
import { CopyLinkField } from "./CopyLinkField";
import { formatRelative } from "@/lib/advisor/format";
import type { LeadRecord } from "@/types/lead";
import type { StaffUserRecord } from "@/types/advisor";

function MetaField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

export function ClientHeaderCard({
  lead,
  advisor,
  brandName,
  isAdminUser,
  staff,
  portalUrl,
  needsFollowUp,
  lastActivityLabel,
}: {
  lead: LeadRecord;
  advisor: StaffUserRecord | null;
  brandName: string | null;
  isAdminUser: boolean;
  staff: StaffUserRecord[];
  portalUrl: string;
  /** Drives the small amber indicator next to the stage — the full-width
   * banner this used to be lives in Next Best Action's copy instead, so the
   * advisor isn't told the same thing twice. */
  needsFollowUp: boolean;
  /** Most recent meaningful event's label, e.g. "Questionnaire completed". */
  lastActivityLabel: string | null;
}) {
  const fullName = `${lead.first_name} ${lead.last_name}`;
  const advisorOptions = staff
    .filter((s) => s.active)
    .map((s) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` }));

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <InitialsAvatar name={fullName} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-serif text-2xl font-semibold text-foreground">{fullName}</h1>
                <StageStatusControl investorId={lead.id} currentStage={lead.current_stage} />
                {needsFollowUp && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-xs font-medium text-[#92400e]">
                    <span className="size-1.5 rounded-full bg-[#d97706]" aria-hidden />
                    Needs follow-up
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-secondary-foreground">
                <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 hover:text-primary">
                  <Mail className="size-3.5 text-muted-foreground" />
                  {lead.email}
                </a>
                {lead.phone && (
                  <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 hover:text-primary">
                    <Phone className="size-3.5 text-muted-foreground" />
                    {lead.phone}
                  </a>
                )}
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Share2 className="size-3.5" />
                  Source: {lead.source ?? "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
            <MetaField label="Brand" value={brandName ?? "—"} />
            <MetaField
              label="Assigned Advisor"
              value={
                isAdminUser ? (
                  <AdvisorAssignmentControl
                    investorId={lead.id}
                    currentAdvisorId={lead.assigned_advisor_id}
                    advisors={advisorOptions}
                  />
                ) : advisor ? (
                  <span className="flex items-center gap-1.5">
                    <InitialsAvatar name={`${advisor.first_name} ${advisor.last_name}`} size="sm" />
                    {advisor.first_name}
                  </span>
                ) : (
                  "Unassigned"
                )
              }
            />
            <MetaField
              label="Last Activity"
              value={
                <>
                  {formatRelative(lead.last_activity_at ?? lead.created_at)}
                  {lastActivityLabel && (
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      {lastActivityLabel}
                    </span>
                  )}
                </>
              }
            />
            <MetaField label="Portal" value={<CopyLinkField value={portalUrl} />} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
