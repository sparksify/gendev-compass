# Multi-Tenant Security

## Tenancy model

`organizations` is the tenant boundary. Every new table carries a required
`organization_id` (directly, or through a required parent such as
`opportunity_assignments → opportunities`). There are no global business
records; platform-level concepts would use the `PLATFORM` organization type
deliberately.

The same human may exist as separate `clients` rows in different
organizations — cross-tenant identity is intentionally not modeled, and
records are never merged across organizations.

## Two access modes

### Current access mode (this phase)

- The browser only ever calls Next.js server routes.
- The server verifies the staff session, resolves profile + membership, and
  checks organization scope before touching data.
- Database access uses the **service-role key, server-side only**. It is
  never exposed to the browser (`lib/supabase/admin.ts`), and RLS denies all
  direct anonymous/authenticated table access.

### Future access mode (prepared, inactive)

- Supabase Auth users connect through `profiles.auth_user_id`.
- RLS policies grant the `authenticated` role **read** access scoped by
  active organization membership. These policies exist today but match no
  one, because `auth_user_id` is null for every profile until the auth
  migration.
- Client portal access would use either authenticated identity or a
  controlled portal-token RPC — the deny-all posture on lead-scoped tables is
  unchanged in this phase.

## RLS inventory

Enabled (deny-all unless a policy matches) on every table, old and new. New
policies added by `0005_platform_domain.sql`:

| Table | Policy | Scope |
| --- | --- | --- |
| organizations | `organizations_member_read` | select, active member of that org |
| profiles | `profiles_self_read` | select, own row (`auth_user_id = auth.uid()`) |
| organization_memberships | `organization_memberships_self_read` | select, own memberships |
| clients / brands / opportunities / activity_events / territory_requests / opportunity_fdd_workflows | `*_member_read` | select, active member of the owning org |
| external_record_mappings, integration_connections, opportunity_assignments | *(none — deny-all)* | server-only concerns |

No `using (true)` policies exist anywhere. No insert/update/delete policies
exist — all writes stay server-side in this phase.

## Policy helper functions

- `public.app_current_profile_id()` — active profile for `auth.uid()`.
- `public.app_is_org_member(org_id uuid)` — active membership check.

Both are `stable`, `security definer`, `set search_path = ''` (immune to
search-path hijacking), revoked from `public`, and granted only to
`authenticated`.

## Secrets

- The Supabase service-role key and all provider credentials (GoHighLevel
  token, webhook secrets) live in **server environment variables only**.
- `integration_connections.config` holds non-secret configuration;
  `secret_reference` names an environment variable or future vault key —
  the schema never stores a plaintext secret, and code must keep it that way.

## Webhook trust

- FDD webhooks: HMAC-SHA256 signature (`FDD_WEBHOOK_SECRET`), replay
  protection via external event IDs in the immutable audit log, forward-only
  status transitions, envelope-mismatch quarantine.
- Calendar webhooks: shared secret header; unmatched events are rejected,
  never fabricated into records.
- Both remain unchanged by this migration; activity events additionally
  dedupe provider event IDs per organization + source.
