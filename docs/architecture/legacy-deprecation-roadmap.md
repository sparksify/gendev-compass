# Legacy Deprecation Roadmap

Nothing is removed in the current phase. This roadmap defines *future* safe
steps, each gated on verifiable preconditions. Ordering within a stage is
flexible; stages are sequential.

## Permanently retained (never deprecate)

- **`leads`** — the permanent marketing-acquisition and portal-entry record.
  `portal_token` values must never change or be migrated.
- **`fdd_audit_log`** — legally significant, immutable, append-only.
- **`questionnaire_submissions` / `questionnaire_answers`** — immutable
  qualification history.
- **`portal_events` rows** — historical event data (the table may eventually
  become read-only, but rows are never deleted).

## Stage 1 — after one release cycle of dual-write parity

Preconditions: monitoring shows opportunity-level and lead-level values agree
for all active records; migrations 0005/0006 applied everywhere.

- Switch remaining readers (dashboard columns, export route, portal FDD
  card) from lead fields to opportunity/workflow fields exclusively.
- Make `leads.organization_id / client_id / primary_opportunity_id /
  brand_id` `not null` (safe once intake always builds the chain).

## Stage 2 — after Supabase Auth migration

Preconditions: all staff sign in through Supabase Auth;
`profiles.auth_user_id` populated for every active profile.

- Retire `staff_sessions` (custom session issuance stops).
- Freeze `staff_users` as read-only history; stop reading `password_hash`.
- Advisor authorization runs purely on profile + membership.

## Stage 3 — event system convergence

Preconditions: all timeline consumers read `activity_events`.

- Stop dual-writing `portal_events` (single write to `activity_events`).
- Mark `portal_events` read-only/archived.

## Stage 4 — lead field cleanup (opt-in, may never happen)

Preconditions: Stages 1–3 complete plus a verified backup and a full audit.

- Stop writing the lead mirrors: `current_stage`, `assigned_advisor_id`,
  `qualification_*`, `fdd_*`, `appointment_id`, `appointment_start_at`.
- Columns stay in place (dropping them buys little and risks much); they are
  simply no longer written. If a drop is ever wanted, it requires its own
  reviewed migration plan — it is **not** part of this roadmap.

## Explicitly never automated

- Client merging. Duplicate candidates are surfaced
  (`findDuplicateCandidates`) and merged only by deliberate human action
  through a future, audited merge tool.
- Any rewrite of existing migration files 0001–0006.
