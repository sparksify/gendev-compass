# Migration Compatibility Plan

How the platform domain migration (0005/0006) coexists with the deployed MVP,
field by field, with the dual-write and fallback rules the application follows
during the transition.

## Sources of truth during the transition

| Data | Current (legacy) source | New (target) source | Transition behavior |
| --- | --- | --- | --- |
| Person identity | `leads` name/email/phone | `clients` | Client created from lead (backfill + runtime repair); lead fields still read by portal UI |
| Pipeline stage | `leads.current_stage` | `opportunities.stage` | **Dual-write** via the stage service; reads prefer opportunity, fall back to lead |
| Advisor assignment | `leads.assigned_advisor_id` | `opportunities.assigned_advisor_profile_id` + `opportunity_assignments` | Dual-write via assign route; dashboard still reads staff user for display |
| Qualification | `leads.qualification_*` | `opportunities.qualification_*` | Dual-write at questionnaire submission |
| FDD state | `leads.fdd_*` | `opportunity_fdd_workflows` | **Lead mirror written first**, then projected onto the workflow (`syncFddWorkflowFromLead`) |
| FDD history | `fdd_audit_log` (lead-linked) | same table, + `opportunity_id`/`fdd_workflow_id` | New rows carry both links; old rows gain links via backfill only |
| Events | `portal_events` | `activity_events` | **Dual-write** in one place (`recordLeadEvent`); backfill copies history via `legacy_portal_event_id` |
| Appointments | `appointments.lead_id` / `advisor_id` | + `opportunity_id`/`client_id`/`advisor_profile_id` | New rows populate both; old rows backfilled |
| Notes | `advisor_notes.lead_id`/`staff_user_id` | + `opportunity_id`/`author_profile_id` | Same |
| Questionnaire snapshot | `questionnaire_responses` (1:1 lead) | same, + `opportunity_id` | Unchanged semantics: latest portal snapshot |
| Questionnaire history | `questionnaire_submissions` | same, + org/client/opportunity/brand links | Immutable, append-only |
| Video progress | `video_progress` (unique per lead) | + org/client/opportunity/brand links; future unique per opportunity+media | Legacy unique constraint retained |
| External IDs | ad-hoc columns | `external_record_mappings` | Both written for new records; legacy columns remain readable |
| Portal entry | `leads.portal_token` | unchanged — permanent | Tokens never change; portal lookup stays lead-first |

## Dual-write rules (no loops)

Every synchronized pair has exactly **one writer and one direction**:

1. **Stage**: `lib/advisor/stages.ts` writes `leads.current_stage`, then calls
   `syncPrimaryOpportunityStage`. Nothing writes the lead stage from the
   opportunity.
2. **FDD**: `lib/fdd/workflow.ts` writes `leads.fdd_*`, then calls
   `syncFddWorkflowFromLead`. Nothing writes lead FDD fields from the
   workflow row.
3. **Events**: `recordLeadEvent` (lib/domain/activities.ts) writes
   `portal_events` then `activity_events`. No other code inserts events.
4. **Assignment**: the assign route writes `leads.assigned_advisor_id`, then
   `assignAdvisorToOpportunity`.

No database triggers are used. All synchronization is explicit, testable
service-layer code.

## Read fallback rules

- Advisor dashboard (`loadInvestorRows`): opportunity stage / FDD workflow /
  last-activity **when the lead's chain is resolved**, otherwise the legacy
  lead values. Both agree whenever the chain exists, because of the
  single-writer rules above.
- Portal (`loadPortalContext`): still keyed by `portal_token → lead`; the
  chain is loaded (and repaired) around it. If chain resolution fails the
  portal renders exactly as before from the lead.

## Backfill behavior

`0007_platform_backfill.sql` (rerunnable — see `scripts/test-migrations.sh`,
which applies it twice against a live cluster and asserts no duplicates):

- Keys: `organizations.slug`, `brands (organization_id, slug)`,
  `profiles.legacy_staff_user_id`, `clients.source_lead_id`,
  `opportunities.source_lead_id`, `opportunity_fdd_workflows.opportunity_id`,
  `activity_events.legacy_portal_event_id`.
- Updates fill **NULL link columns only**; no legacy value is modified.
- Leads created after the deploy but before the migration (or in
  environments that never run it, like local dev) are repaired at runtime by
  `ensureLeadDomainChain` using identical provenance keys.

## Ordering: deploy vs. migrate

Either order is safe:

- **Migrate first** (recommended): new columns exist; the old code ignores
  them.
- **Deploy first**: new code detects missing chains and — because the new
  *tables* don't exist yet — chain resolution fails, is logged, and every
  legacy path continues from the lead. Run the migrations to activate the
  domain model. (Recommended anyway: apply 0006+0007 before deploying.)

## When legacy fields can be removed

Not in this phase. See `legacy-deprecation-roadmap.md`. Preconditions for any
removal: all readers migrated to opportunity-level sources, one full release
cycle of dual-write parity monitoring, and a verified backup.
