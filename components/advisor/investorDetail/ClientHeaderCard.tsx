import { Building2, Clock3, ExternalLink, Flame, Mail, Phone, Share2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AdvisorAssignmentControl } from "./AdvisorAssignmentControl";
import { StageStatusControl } from "./StageStatusControl";
import { InitialsAvatar } from "./InitialsAvatar";
import { CopyPortalButton } from "./CopyPortalButton";
import { TerritoriesWantedControl } from "./TerritoriesWantedControl";
import { formatRelative } from "@/lib/advisor/format";
import { cn } from "@/lib/utils";
import type { LeadRecord } from "@/types/lead";
import type { StaffUserRecord } from "@/types/advisor";

function MetaColumn({
  label,
  icon: Icon,
  children,
  bordered = true,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  bordered?: boolean;
}) {
  return (
    <div className={cn(bordered && "border-l border-border-soft pl-[18px]")}>
      <p className="flex items-center gap-1 text-[11px] text-faint-foreground">
        {Icon && <Icon className="size-3" />}
        {label}
      </p>
      <div className="mt-1 text-[13px] font-semibold text-foreground">{children}</div>
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
  isHotLead,
  lastActivityLabel,
}: {
  lead: LeadRecord;
  advisor: StaffUserRecord | null;
  brandName: string | null;
  isAdminUser: boolean;
  staff: StaffUserRecord[];
  portalUrl: string;
  needsFollowUp: boolean;
  /** Activity within the last 24h — rendered as a header pill (replaces the
   * old standalone HotLeadSignalCard). */
  isHotLead: boolean;
  /** Most recent meaningful event's label, e.g. "Questionnaire completed". */
  lastActivityLabel: string | null;
}) {
  const fullName = `${lead.first_name} ${lead.last_name}`;
  const advisorOptions = staff
    .filter((s) => s.active)
    .map((s) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` }));

  return (
    <Card>
      <CardContent className="px-[18px] py-4">
        <div className="flex flex-wrap items-start gap-3">
          {/* Identity block */}
          <div className="flex shrink-0 items-start gap-3">
            <InitialsAvatar name={fullName} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-x-[9px] gap-y-1.5">
                <h1 className="font-serif text-[19px] font-semibold leading-tight text-foreground">
                  {fullName}
                </h1>
                <StageStatusControl investorId={lead.id} currentStage={lead.current_stage} />
                {isHotLead && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#cfebd8] bg-[#f2faf5] px-2 py-0.5 text-[11px] font-medium text-[#15803d]">
                    <Flame className="size-[11px]" />
                    Hot lead
                  </span>
                )}
                {needsFollowUp && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fef3c7] px-2 py-0.5 text-[11px] font-medium text-[#92400e]">
                    <span className="size-1.5 rounded-full bg-[#d97706]" aria-hidden />
                    Needs follow-up
                  </span>
                )}
              </div>
              {brandName && <p className="mt-[3px] text-xs text-muted-foreground">{brandName}</p>}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-secondary-foreground">
                <a href={`mailto:${lead.email}`} className="flex items-center gap-[7px] hover:text-primary">
                  <Mail className="size-[13px] text-faint-foreground" />
                  {lead.email}
                </a>
                {lead.phone && (
                  <a href={`tel:${lead.phone}`} className="flex items-center gap-[7px] hover:text-primary">
                    <Phone className="size-[13px] text-faint-foreground" />
                    {lead.phone}
                  </a>
                )}
                <span className="flex items-center gap-[7px]">
                  <Share2 className="size-[13px] text-faint-foreground" />
                  {lead.source ?? "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Meta strip */}
          <div className="ml-auto flex flex-wrap items-start gap-x-[18px] gap-y-3">
            <MetaColumn label="Territories wanted" icon={Building2}>
              <TerritoriesWantedControl
                investorId={lead.id}
                value={lead.territories_wanted ?? null}
              />
              <p className="mt-1 text-[11px] font-normal text-faint-foreground">Advisor estimate</p>
            </MetaColumn>
            <MetaColumn label="Advisor">
              {isAdminUser ? (
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
              )}
            </MetaColumn>
            <MetaColumn label="Last activity" icon={Clock3}>
              {formatRelative(lead.last_activity_at ?? lead.created_at)}
              {lastActivityLabel && (
                <span className="mt-0.5 block text-[11px] font-normal text-faint-foreground">
                  {lastActivityLabel}
                </span>
              )}
            </MetaColumn>
            <div className="flex items-center gap-2 self-center pl-[18px]">
              <a
                href={portalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-control border border-[#bfd4ff] bg-card px-[13px] py-[7px] text-xs font-semibold text-primary transition-colors hover:bg-primary-soft"
              >
                Open portal
                <ExternalLink className="size-3" />
              </a>
              <CopyPortalButton portalUrl={portalUrl} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
