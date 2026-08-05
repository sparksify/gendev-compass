# Authentication & Authorization

## Authentication (current, transitional)

The custom staff authentication is **preserved unchanged**:

- `staff_users` holds email + scrypt password hash (`lib/advisor/password.ts`).
- `staff_sessions` stores only the SHA-256 hash of a random session token;
  the browser holds the token in an HttpOnly, SameSite=Lax cookie.
- Mutating staff APIs additionally enforce same-origin (`sameOriginOk`).

This system is **transitional**: the target is Supabase Auth, but migrating
logins is explicitly out of scope for this phase. Nothing in the new
architecture depends on the migration happening on any particular schedule.

Password hashes live in `staff_users` only. Profiles never store or expose
credential material.

### Client (prospect) authentication

Prospects do not authenticate. Magic-link portal tokens
(`leads.portal_token`) remain the access mechanism, unchanged. The future
hook for real client logins is `clients.profile_id` →
`profiles.auth_user_id`; nothing forces that migration now.

## The identity adapter

```
staff session cookie
  → staff_sessions (token hash)
  → staff_users
  → profiles          (via profiles.legacy_staff_user_id)
  → organization_memberships (via the default organization)
```

- `resolveAdvisorContext(staffUser)` (lib/domain/memberships.ts) returns
  `{ staffUser, profile, organization, membership }`, creating the profile
  and membership on demand for environments where the SQL backfill has not
  run. Role mapping: staff `ADMIN` → membership `ORGANIZATION_ADMIN`, staff
  `ADVISOR` → membership `ADVISOR`.
- `requireAdvisorContextApi()` (lib/advisor/auth.ts) is the API-route guard
  version: 401 when unauthenticated, 403 when the membership is not active.

## Authorization model

All authorization is **server-side**; hiding UI elements is never the control.

- `canAccessOrganization(ctx, orgId)` — active membership in that org.
- `hasOrganizationRole(ctx, roles)` / `requireOrganizationRole` — role check
  on the active membership.
- `canAccessOpportunity(ctx, opportunity)` — organization match **plus**
  admin role, the pilot `ADVISOR_SEES_ALL` mode, or an actual assignment
  (profile or membership). Cross-organization access is denied even in
  sees-all mode.
- `canAccessClient(ctx, client)` — organization scoping.
- Legacy `canAccessLead` (lib/advisor/access.ts) remains for existing
  lead-centric routes; its semantics are unchanged within the single
  organization.

Client-supplied IDs (organization, brand, advisor, opportunity) are never
trusted: routes resolve them server-side and verify scope. Possession of an
opportunity UUID is not authorization.

### ADMIN is not platform-admin

The legacy staff `ADMIN` role maps to `ORGANIZATION_ADMIN` **of GenDev
only**. The `PLATFORM_ADMIN` membership role exists in the vocabulary but no
code path grants cross-organization access in this phase — adding it later is
a deliberate feature, not a default.

## Future Supabase Auth migration plan (not executed now)

1. Enable Supabase Auth; create auth users for staff (email invitations —
   never migrate password hashes).
2. Link `profiles.auth_user_id` on first login.
3. Switch session resolution to Supabase Auth JWTs; keep
   `resolveAdvisorContext` as the single entry point so route code does not
   change.
4. Retire `staff_sessions`, then freeze `staff_users` (keep for audit
   history; `legacy_staff_user_id` links remain).
5. RLS policies (already written against `auth.uid()` + memberships) begin
   granting the authenticated role real, membership-scoped access.
