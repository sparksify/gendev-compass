import { getStore } from "@/lib/store";
import { resolveDefaultOrganization } from "@/lib/domain/organizations";
import { resolveProfileForStaffUser } from "@/lib/domain/profiles";
import { advisorSeesAll } from "@/lib/advisor/access";
import type { StaffUserRecord } from "@/types/advisor";
import type {
  MembershipRole,
  OpportunityRecord,
  OrganizationMembershipRecord,
  OrganizationRecord,
  ProfileRecord,
} from "@/types/domain";

/**
 * Membership + authorization service.
 *
 * Transitional identity adapter:
 *   staff session → staff_user → profile → organization membership
 *
 * All advisor authorization flows through the AdvisorContext produced here.
 * The legacy staff `ADMIN` role maps to ORGANIZATION_ADMIN of the default
 * organization — it is intentionally NOT platform-wide access (see
 * docs/architecture/authentication-authorization.md).
 */

export interface AdvisorContext {
  staffUser: StaffUserRecord;
  profile: ProfileRecord;
  organization: OrganizationRecord;
  membership: OrganizationMembershipRecord;
}

function membershipRoleForStaff(staffUser: StaffUserRecord): MembershipRole {
  return staffUser.role === "ADMIN" ? "ORGANIZATION_ADMIN" : "ADVISOR";
}

/**
 * Resolves (creating on demand) the profile and default-organization
 * membership for an authenticated staff user.
 */
export async function resolveAdvisorContext(
  staffUser: StaffUserRecord,
): Promise<AdvisorContext> {
  const store = getStore();
  const [profile, organization] = [
    await resolveProfileForStaffUser(staffUser),
    await resolveDefaultOrganization(),
  ];

  let membership = await store.getMembership(organization.id, profile.id);
  if (!membership) {
    try {
      membership = await store.createMembership({
        organization_id: organization.id,
        profile_id: profile.id,
        role: membershipRoleForStaff(staffUser),
        status: staffUser.active ? "active" : "inactive",
      });
    } catch {
      membership = await store.getMembership(organization.id, profile.id);
      if (!membership) {
        throw new Error(`Failed to resolve membership for profile ${profile.id}`);
      }
    }
  }

  return { staffUser, profile, organization, membership };
}

export function isActiveMembership(membership: OrganizationMembershipRecord): boolean {
  return membership.status === "active";
}

/** Whether the context may act inside the given organization at all. */
export function canAccessOrganization(ctx: AdvisorContext, organizationId: string): boolean {
  return ctx.membership.organization_id === organizationId && isActiveMembership(ctx.membership);
}

export function hasOrganizationRole(
  ctx: AdvisorContext,
  roles: readonly MembershipRole[],
): boolean {
  return isActiveMembership(ctx.membership) && roles.includes(ctx.membership.role);
}

export function isOrganizationAdmin(ctx: AdvisorContext): boolean {
  return hasOrganizationRole(ctx, ["ORGANIZATION_ADMIN", "PLATFORM_ADMIN"]);
}

/**
 * Opportunity access: same-organization active membership, plus either
 * admin rights, the pilot advisor-sees-all mode, or an actual assignment.
 */
export function canAccessOpportunity(
  ctx: AdvisorContext,
  opportunity: Pick<
    OpportunityRecord,
    "organization_id" | "assigned_advisor_profile_id" | "assigned_advisor_membership_id"
  >,
  seesAll: boolean = advisorSeesAll(),
): boolean {
  if (!canAccessOrganization(ctx, opportunity.organization_id)) return false;
  if (isOrganizationAdmin(ctx)) return true;
  if (seesAll) return true;
  return (
    opportunity.assigned_advisor_profile_id === ctx.profile.id ||
    opportunity.assigned_advisor_membership_id === ctx.membership.id
  );
}

/** Client access mirrors organization scoping (clients are org-level records). */
export function canAccessClient(
  ctx: AdvisorContext,
  client: { organization_id: string },
): boolean {
  return canAccessOrganization(ctx, client.organization_id);
}

/** Throwing guards for service-layer use. */
export function requireOrganizationMembership(
  ctx: AdvisorContext,
  organizationId: string,
): void {
  if (!canAccessOrganization(ctx, organizationId)) {
    throw new AuthorizationError("No active membership in this organization");
  }
}

export function requireOrganizationRole(
  ctx: AdvisorContext,
  roles: readonly MembershipRole[],
): void {
  if (!hasOrganizationRole(ctx, roles)) {
    throw new AuthorizationError("Insufficient organization role");
  }
}

export function requireOpportunityAccess(
  ctx: AdvisorContext,
  opportunity: Pick<
    OpportunityRecord,
    "organization_id" | "assigned_advisor_profile_id" | "assigned_advisor_membership_id"
  >,
): void {
  if (!canAccessOpportunity(ctx, opportunity)) {
    throw new AuthorizationError("No access to this opportunity");
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}
