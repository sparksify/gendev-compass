import { Mail, Phone, Share2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StageBadge } from "@/components/advisor/StageBadge";
import { StageSelect } from "@/components/advisor/StageSelect";
import { AssignAdvisorSelect } from "@/components/advisor/AssignAdvisorSelect";
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
}: {
  lead: LeadRecord;
  advisor: StaffUserRecord | null;
  brandName: string | null;
  isAdminUser: boolean;
  staff: StaffUserRecord[];
  portalUrl: string;
}) {
  const fullName = `${lead.first_name} ${lead.last_name}`;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <InitialsAvatar name={fullName} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-serif text-2xl font-semibold text-foreground">{fullName}</h1>
                <StageBadge stage={lead.current_stage} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-secondary-foreground">
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

          <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
            <MetaField label="Brand" value={brandName ?? "—"} />
            <MetaField
              label="Assigned Advisor"
              value={
                advisor ? (
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
              value={formatRelative(lead.last_activity_at ?? lead.created_at)}
            />
            <MetaField label="Portal Link" value={<CopyLinkField value={portalUrl} />} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-border-soft pt-4">
          <div className="w-52">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Stage</p>
            <StageSelect investorId={lead.id} currentStage={lead.current_stage} />
          </div>
          {isAdminUser && (
            <div className="w-52">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Assigned advisor</p>
              <AssignAdvisorSelect
                investorId={lead.id}
                currentAdvisorId={lead.assigned_advisor_id}
                advisors={staff
                  .filter((s) => s.active)
                  .map((s) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` }))}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
