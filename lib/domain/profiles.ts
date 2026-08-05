import { getStore } from "@/lib/store";
import type { StaffUserRecord } from "@/types/advisor";
import type { ProfileRecord } from "@/types/domain";

/**
 * Profile service. Profiles are the application-level identity that bridges
 * the legacy staff auth (legacy_staff_user_id) and future Supabase Auth
 * (auth_user_id). Password hashes never leave staff_users.
 */

export async function getProfileById(id: string): Promise<ProfileRecord | null> {
  return getStore().getProfileById(id);
}

/**
 * Resolves the profile for a legacy staff user, creating it on demand for
 * environments where the SQL backfill has not run (local dev store) or for
 * staff users created after the backfill.
 */
export async function resolveProfileForStaffUser(
  staffUser: StaffUserRecord,
): Promise<ProfileRecord> {
  const store = getStore();
  const existing = await store.getProfileByLegacyStaffUserId(staffUser.id);
  if (existing) return existing;

  // A profile may already exist for this email (e.g. created ahead of the
  // staff account). Adopt it rather than failing on the unique email index —
  // but only if it is not already bound to a different staff user.
  const byEmail = await store.getProfileByEmail(staffUser.email);
  if (byEmail && !byEmail.legacy_staff_user_id) return byEmail;

  try {
    return await store.createProfile({
      legacy_staff_user_id: staffUser.id,
      first_name: staffUser.first_name,
      last_name: staffUser.last_name,
      email: staffUser.email,
      status: staffUser.active ? "active" : "inactive",
    });
  } catch {
    const raced = await store.getProfileByLegacyStaffUserId(staffUser.id);
    if (raced) return raced;
    throw new Error(`Failed to resolve profile for staff user ${staffUser.id}`);
  }
}
